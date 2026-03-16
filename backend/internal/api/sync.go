package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rippleglen/rcg-backend/internal/store"
)

type syncRequest struct {
	// Nested by directory category, e.g. {"mods": {"sodium.jar": "sha256..."}}
	Files map[string]map[string]string `json:"files"`
}

type syncResponse struct {
	NeedsUpdate   bool     `json:"needsUpdate"`
	DownloadToken string   `json:"downloadToken,omitempty"`
	FilesToDelete []string `json:"filesToDelete"`
}

// syncCheck compares client file hashes to the server manifest.
// POST /sync/{name}
func (r *router) syncCheck(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")

	manifest, err := r.cfg.Store.ReadManifest(name)
	if err != nil {
		jsonError(w, "modpack not found", http.StatusNotFound)
		return
	}

	var body syncRequest
	if err := decodeJSON(req, &body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Flatten the nested map from the client into the same format as the manifest
	// e.g. {"mods": {"sodium.jar": "abc"}} → {"mods/sodium.jar": "abc"}
	flat := map[string]string{}
	for dir, files := range body.Files {
		for file, hash := range files {
			flat[dir+"/"+file] = hash
		}
	}

	diff := store.ComputeDiff(manifest, flat)

	if !diff.NeedsUpdate {
		jsonOK(w, syncResponse{NeedsUpdate: false, FilesToDelete: []string{}})
		return
	}

	token := newToken()
	r.mu.Lock()
	r.tokens[token] = syncToken{
		modpack:   name,
		diff:      &diff,
		expiresAt: time.Now().Add(10 * time.Minute),
	}
	r.mu.Unlock()

	jsonOK(w, syncResponse{
		NeedsUpdate:   true,
		DownloadToken: token,
		FilesToDelete: diff.FilesToDelete,
	})
}

// syncDownload streams a zip of changed files to the client.
// GET /sync/{name}/download/{token}
func (r *router) syncDownload(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")
	token := chi.URLParam(req, "token")

	r.mu.Lock()
	entry, ok := r.tokens[token]
	if ok {
		delete(r.tokens, token) // one-time use
	}
	r.mu.Unlock()

	if !ok || entry.modpack != name || time.Now().After(entry.expiresAt) {
		jsonError(w, "invalid or expired token", http.StatusGone)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="update.zip"`)
	// Remove the JSON content-type set by middleware
	w.Header().Del("Content-Type")
	w.Header().Set("Content-Type", "application/zip")

	if err := r.cfg.Store.WriteUpdateZip(name, entry.diff, w); err != nil {
		// Headers already sent — can't send an error response, just log
		return
	}
}

func newToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
