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

// FileInfo describes a single file in a modpack category.
type FileInfo struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	Hash string `json:"hash"`
}

// CategoryFiles maps category name → file list.
type CategoryFiles map[string][]FileInfo

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
	LoaderType    string `json:"loaderType,omitempty"`
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

// ListFiles returns all managed files grouped by category.
func (s *Store) ListFiles(modpackName string) (CategoryFiles, error) {
	base := s.ModpackDir(modpackName)
	result := CategoryFiles{
		"mods":         {},
		"config":       {},
		"resourcepacks": {},
		"shaderpacks":  {},
	}

	manifest, _ := s.ReadManifest(modpackName)
	fileHashes := map[string]string{}
	if manifest != nil {
		fileHashes = manifest.Files
	}

	for cat := range result {
		dir := filepath.Join(base, cat)
		entries, err := os.ReadDir(dir)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return nil, err
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			info, err := e.Info()
			if err != nil {
				continue
			}
			result[cat] = append(result[cat], FileInfo{
				Name: e.Name(),
				Size: info.Size(),
				Hash: fileHashes[cat+"/"+e.Name()],
			})
		}
	}
	return result, nil
}

// SaveFile writes a single file into a category directory and updates the manifest.
func (s *Store) SaveFile(modpackName, category, filename string, r io.Reader) error {
	allowed := map[string]bool{"mods": true, "config": true, "resourcepacks": true, "shaderpacks": true}
	if !allowed[category] {
		return fmt.Errorf("invalid category %q", category)
	}
	filename = filepath.Base(filename)
	if filename == "" || filename == "." {
		return fmt.Errorf("invalid filename")
	}

	dir := filepath.Join(s.ModpackDir(modpackName), category)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	dest := filepath.Join(dir, filename)
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		return err
	}
	f.Close()

	hash, err := hashFile(dest)
	if err != nil {
		return err
	}
	manifest, err := s.ReadManifest(modpackName)
	if err != nil {
		manifest = &Manifest{Files: map[string]string{}}
	}
	manifest.Files[category+"/"+filename] = hash
	return s.WriteManifest(modpackName, manifest)
}

// DeleteFile removes a file from a category and updates the manifest.
func (s *Store) DeleteFile(modpackName, category, filename string) error {
	allowed := map[string]bool{"mods": true, "config": true, "resourcepacks": true, "shaderpacks": true}
	if !allowed[category] {
		return fmt.Errorf("invalid category %q", category)
	}
	filename = filepath.Base(filename)
	fullPath := filepath.Join(s.ModpackDir(modpackName), category, filename)
	if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	manifest, err := s.ReadManifest(modpackName)
	if err != nil {
		return nil
	}
	delete(manifest.Files, category+"/"+filename)
	return s.WriteManifest(modpackName, manifest)
}

// ReadTiers reads mod tier assignments (required/suggested/optional) for a modpack.
func (s *Store) ReadTiers(modpackName string) (map[string]string, error) {
	path := filepath.Join(s.ModpackDir(modpackName), "tiers.json")
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return map[string]string{}, nil
	}
	if err != nil {
		return nil, err
	}
	var tiers map[string]string
	if err := json.Unmarshal(data, &tiers); err != nil {
		return nil, err
	}
	return tiers, nil
}

// WriteTiers saves mod tier assignments for a modpack.
func (s *Store) WriteTiers(modpackName string, tiers map[string]string) error {
	dir := s.ModpackDir(modpackName)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(tiers, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "tiers.json"), data, 0644)
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
