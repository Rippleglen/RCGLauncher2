package store

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Store manages files on disk under a data directory.
type Store struct {
	dataDir string
}

func New(dataDir string) *Store {
	return &Store{dataDir: dataDir}
}

// ModpackDir returns the absolute path to a modpack's files.
func (s *Store) ModpackDir(name string) string {
	return filepath.Join(s.dataDir, "modpacks", name)
}

// SkinsDir returns the absolute path for skin storage.
func (s *Store) SkinsDir() string {
	return filepath.Join(s.dataDir, "skins")
}

// --- Modpack manifest ---

// Manifest is the server's source of truth for a modpack's files.
type Manifest struct {
	Files map[string]string `json:"files"` // relative path → sha256 hex
}

func (s *Store) ReadManifest(modpackName string) (*Manifest, error) {
	path := filepath.Join(s.ModpackDir(modpackName), "manifest.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("manifest not found for %q: %w", modpackName, err)
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *Store) WriteManifest(modpackName string, m *Manifest) error {
	dir := s.ModpackDir(modpackName)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "manifest.json"), data, 0644)
}

// RegenerateManifest walks all modpack files and rebuilds manifest.json from them.
func (s *Store) RegenerateManifest(modpackName string) (*Manifest, error) {
	base := s.ModpackDir(modpackName)
	m := &Manifest{Files: map[string]string{}}

	managedDirs := []string{"mods", "config", "resourcepacks", "shaderpacks", "ffmpeg"}

	for _, dir := range managedDirs {
		fullDir := filepath.Join(base, dir)
		if _, err := os.Stat(fullDir); os.IsNotExist(err) {
			continue
		}

		err := filepath.Walk(fullDir, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return err
			}
			rel, _ := filepath.Rel(base, path)
			rel = filepath.ToSlash(rel)
			hash, err := hashFile(path)
			if err != nil {
				return err
			}
			m.Files[rel] = hash
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	if err := s.WriteManifest(modpackName, m); err != nil {
		return nil, err
	}
	return m, nil
}

// --- Modpack metadata ---

type ModpackMeta struct {
	Name          string `json:"name"`
	DisplayName   string `json:"displayName"`
	MCVersion     string `json:"mcVersion"`
	LoaderVersion string `json:"loaderVersion,omitempty"`
	Description   string `json:"description"`
	HeroImage     string `json:"heroImage,omitempty"`
	Icon          string `json:"icon,omitempty"`
	PatchCategory string `json:"patchCategory,omitempty"`
}

func (s *Store) ReadModpackMeta(name string) (*ModpackMeta, error) {
	path := filepath.Join(s.ModpackDir(name), "modpack.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var meta ModpackMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

func (s *Store) WriteModpackMeta(meta *ModpackMeta) error {
	dir := s.ModpackDir(meta.Name)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "modpack.json"), data, 0644)
}

// ListModpacks returns metadata for all modpacks found in the data directory.
func (s *Store) ListModpacks() ([]ModpackMeta, error) {
	base := filepath.Join(s.dataDir, "modpacks")
	entries, err := os.ReadDir(base)
	if err != nil {
		if os.IsNotExist(err) {
			return []ModpackMeta{}, nil
		}
		return nil, err
	}

	var packs []ModpackMeta
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		meta, err := s.ReadModpackMeta(e.Name())
		if err != nil {
			continue // skip modpacks without metadata
		}
		packs = append(packs, *meta)
	}
	return packs, nil
}

// --- Sync: compute diff and build update zip ---

type SyncDiff struct {
	NeedsUpdate   bool     `json:"needsUpdate"`
	FilesToDelete []string `json:"filesToDelete"`
	// internal — files the server needs to zip up for the client
	filesToSend []string
}

// ComputeDiff compares client file hashes against the server manifest.
func ComputeDiff(manifest *Manifest, clientFiles map[string]string) SyncDiff {
	diff := SyncDiff{FilesToDelete: []string{}}

	// Files the client has that are not in the manifest → delete
	for path := range clientFiles {
		if _, ok := manifest.Files[path]; !ok {
			diff.FilesToDelete = append(diff.FilesToDelete, path)
			diff.NeedsUpdate = true
		}
	}

	// Files in the manifest that the client is missing or has a different hash → send
	for path, serverHash := range manifest.Files {
		clientHash, exists := clientFiles[path]
		if !exists || clientHash != serverHash {
			diff.filesToSend = append(diff.filesToSend, path)
			diff.NeedsUpdate = true
		}
	}

	return diff
}

// WriteUpdateZip streams a zip of the files the client needs into w.
func (s *Store) WriteUpdateZip(modpackName string, diff *SyncDiff, w io.Writer) error {
	base := s.ModpackDir(modpackName)
	zw := zip.NewWriter(w)
	defer zw.Close()

	for _, rel := range diff.filesToSend {
		// Sanitise path — no traversal
		clean := filepath.Clean(filepath.FromSlash(rel))
		if strings.HasPrefix(clean, "..") {
			continue
		}

		src := filepath.Join(base, clean)
		f, err := os.Open(src)
		if err != nil {
			return fmt.Errorf("opening %s: %w", rel, err)
		}

		entry, err := zw.Create(filepath.ToSlash(rel))
		if err != nil {
			f.Close()
			return err
		}

		if _, err := io.Copy(entry, f); err != nil {
			f.Close()
			return err
		}
		f.Close()
	}

	return nil
}

// --- Skin files ---

func (s *Store) SaveSkin(uuid, filename string, r io.Reader) error {
	dir := filepath.Join(s.SkinsDir(), uuid)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	dest := filepath.Join(dir, filename)
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func (s *Store) SkinPath(uuid, filename string) string {
	return filepath.Join(s.SkinsDir(), uuid, filename)
}

// --- Admin: extract uploaded zip into a modpack directory ---

func (s *Store) ExtractModpackZip(modpackName string, r io.ReaderAt, size int64) error {
	base := s.ModpackDir(modpackName)
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return err
	}

	for _, f := range zr.File {
		clean := filepath.Clean(filepath.FromSlash(f.Name))
		if strings.HasPrefix(clean, "..") || f.FileInfo().IsDir() {
			continue
		}
		dest := filepath.Join(base, clean)
		if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.Create(dest)
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

// --- Helpers ---

func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
