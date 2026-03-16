package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// GET /admin/modpacks/{name}/files
// Returns all files grouped by category, with tier info merged in for mods.
func (r *router) adminListFiles(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")

	files, err := r.cfg.Store.ListFiles(name)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tiers, _ := r.cfg.Store.ReadTiers(name)

	type fileEntry struct {
		Name string `json:"name"`
		Size int64  `json:"size"`
		Hash string `json:"hash"`
		Tier string `json:"tier,omitempty"`
	}

	result := map[string][]fileEntry{}
	for cat, fileList := range files {
		entries := make([]fileEntry, 0, len(fileList))
		for _, f := range fileList {
			tier := ""
			if cat == "mods" {
				tier = tiers["mods/"+f.Name]
				if tier == "" {
					tier = "required"
				}
			}
			entries = append(entries, fileEntry{
				Name: f.Name,
				Size: f.Size,
				Hash: f.Hash,
				Tier: tier,
			})
		}
		result[cat] = entries
	}

	jsonOK(w, result)
}

// PUT /admin/modpacks/{name}/files/{category}/{filename}
// Accepts raw file bytes and saves the file to the category directory.
func (r *router) adminUploadFile(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")
	category := chi.URLParam(req, "category")
	filename := chi.URLParam(req, "filename")

	if err := r.cfg.Store.SaveFile(name, category, filename, req.Body); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

// DELETE /admin/modpacks/{name}/files/{category}/{filename}
func (r *router) adminDeleteFile(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")
	category := chi.URLParam(req, "category")
	filename := chi.URLParam(req, "filename")

	if err := r.cfg.Store.DeleteFile(name, category, filename); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

// PUT /admin/modpacks/{name}/tiers
// Saves the full tier map for a modpack's mods.
func (r *router) adminSetTiers(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")
	var tiers map[string]string
	if err := json.NewDecoder(req.Body).Decode(&tiers); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := r.cfg.Store.WriteTiers(name, tiers); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}
