package api

import (
	"bytes"
	"io"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/rippleglen/rcg-backend/internal/store"
)

// adminCreateModpack creates a new modpack with metadata.
// POST /admin/modpacks
func (r *router) adminCreateModpack(w http.ResponseWriter, req *http.Request) {
	var meta store.ModpackMeta
	if err := decodeJSON(req, &meta); err != nil || meta.Name == "" {
		jsonError(w, "invalid modpack metadata", http.StatusBadRequest)
		return
	}
	if err := r.cfg.Store.WriteModpackMeta(&meta); err != nil {
		jsonError(w, "failed to create modpack", http.StatusInternalServerError)
		return
	}
	jsonOK(w, meta)
}

// adminUpdateModpack updates modpack metadata without touching files.
// PUT /admin/modpacks/{name}
func (r *router) adminUpdateModpack(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")

	// Start from existing meta so partial updates work
	existing, err := r.cfg.Store.ReadModpackMeta(name)
	if err != nil {
		existing = &store.ModpackMeta{Name: name}
	}

	if err := decodeJSON(req, existing); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	existing.Name = name // don't let the body rename it

	if err := r.cfg.Store.WriteModpackMeta(existing); err != nil {
		jsonError(w, "failed to update modpack", http.StatusInternalServerError)
		return
	}
	jsonOK(w, existing)
}

// adminPushFiles accepts a zip upload, extracts it into the modpack directory,
// then regenerates the manifest. Use this to push a new modpack version.
// POST /admin/modpacks/{name}/push
func (r *router) adminPushFiles(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")

	// Read entire body into a buffer so we can get the size for zip.NewReader
	body, err := io.ReadAll(io.LimitReader(req.Body, 2<<30)) // 2GB limit
	if err != nil {
		jsonError(w, "failed to read upload", http.StatusBadRequest)
		return
	}

	if err := r.cfg.Store.ExtractModpackZip(name, bytes.NewReader(body), int64(len(body))); err != nil {
		jsonError(w, "failed to extract files: "+err.Error(), http.StatusInternalServerError)
		return
	}

	manifest, err := r.cfg.Store.RegenerateManifest(name)
	if err != nil {
		jsonError(w, "files extracted but manifest generation failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]any{
		"status":    "ok",
		"fileCount": len(manifest.Files),
	})
}

// adminRegenerateManifest rebuilds manifest.json from current files on disk.
// POST /admin/modpacks/{name}/regenerate
func (r *router) adminRegenerateManifest(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")
	manifest, err := r.cfg.Store.RegenerateManifest(name)
	if err != nil {
		jsonError(w, "failed to regenerate manifest: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{
		"status":    "ok",
		"fileCount": len(manifest.Files),
	})
}

// adminDeleteModpack removes a modpack and all its files.
// DELETE /admin/modpacks/{name}
func (r *router) adminDeleteModpack(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")
	dir := r.cfg.Store.ModpackDir(name)
	if err := os.RemoveAll(dir); err != nil {
		jsonError(w, "failed to delete modpack", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "deleted"})
}
