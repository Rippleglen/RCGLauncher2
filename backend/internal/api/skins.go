package api

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

// uploadSkin accepts a PNG, stores it, and returns the hosted URL.
// POST /skins/upload
// Form fields: uuid, skinType (classic|slim), label
func (r *router) uploadSkin(w http.ResponseWriter, req *http.Request) {
	if err := req.ParseMultipartForm(4 << 20); err != nil { // 4MB limit
		jsonError(w, "file too large or invalid form", http.StatusBadRequest)
		return
	}

	uuid := req.FormValue("uuid")
	skinType := req.FormValue("skinType")
	label := req.FormValue("label")

	if uuid == "" {
		jsonError(w, "uuid required", http.StatusBadRequest)
		return
	}
	if skinType != "classic" && skinType != "slim" {
		skinType = "classic"
	}

	file, header, err := req.FormFile("skin")
	if err != nil {
		jsonError(w, "skin file required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if filepath.Ext(header.Filename) != ".png" {
		jsonError(w, "only PNG files accepted", http.StatusBadRequest)
		return
	}

	filename := fmt.Sprintf("%d.png", time.Now().UnixNano())
	if err := r.cfg.Store.SaveSkin(uuid, filename, file); err != nil {
		jsonError(w, "failed to save skin", http.StatusInternalServerError)
		return
	}

	skinURL := fmt.Sprintf("%s/skins/%s/%s", r.cfg.BaseURL, uuid, filename)

	// Ensure user record exists
	r.cfg.DB.UpsertUser(uuid, uuid) // username will be updated by /users PUT

	id, err := r.cfg.DB.AddSkin(uuid, filename, skinType, label)
	if err != nil {
		jsonError(w, "failed to record skin", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]any{
		"id":       id,
		"url":      skinURL,
		"skinType": skinType,
	})
}

// serveSkin serves a skin PNG file.
// GET /skins/{uuid}/{filename}
func (r *router) serveSkin(w http.ResponseWriter, req *http.Request) {
	uuid := chi.URLParam(req, "uuid")
	filename := chi.URLParam(req, "filename")

	path := r.cfg.Store.SkinPath(uuid, filename)
	w.Header().Set("Content-Type", "image/png")
	w.Header().Del("Content-Type") // remove JSON default
	w.Header().Set("Content-Type", "image/png")
	http.ServeFile(w, req, path)
}

// listSkins returns all skins for a user.
// GET /users/{uuid}/skins
func (r *router) listSkins(w http.ResponseWriter, req *http.Request) {
	uuid := chi.URLParam(req, "uuid")
	skins, err := r.cfg.DB.GetSkins(uuid)
	if err != nil {
		jsonError(w, "failed to load skins", http.StatusInternalServerError)
		return
	}

	// Attach URLs
	type skinWithURL struct {
		ID         int64  `json:"id"`
		Filename   string `json:"filename"`
		SkinType   string `json:"skinType"`
		Label      string `json:"label"`
		UploadedAt string `json:"uploadedAt"`
		URL        string `json:"url"`
	}
	result := make([]skinWithURL, len(skins))
	for i, s := range skins {
		result[i] = skinWithURL{
			ID:         s.ID,
			Filename:   s.Filename,
			SkinType:   s.SkinType,
			Label:      s.Label,
			UploadedAt: s.UploadedAt,
			URL:        fmt.Sprintf("%s/skins/%s/%s", r.cfg.BaseURL, uuid, s.Filename),
		}
	}
	jsonOK(w, result)
}

// deleteSkin removes a skin record and its file on disk.
// DELETE /users/{uuid}/skins/{id}
func (r *router) deleteSkin(w http.ResponseWriter, req *http.Request) {
	uuid := chi.URLParam(req, "uuid")
	id, err := strconv.ParseInt(chi.URLParam(req, "id"), 10, 64)
	if err != nil {
		jsonError(w, "invalid skin id", http.StatusBadRequest)
		return
	}

	// Resolve filename before deleting the DB record
	skins, _ := r.cfg.DB.GetSkins(uuid)
	var filename string
	for _, s := range skins {
		if s.ID == id {
			filename = s.Filename
			break
		}
	}

	if err := r.cfg.DB.DeleteSkin(uuid, id); err != nil {
		jsonError(w, "failed to delete skin", http.StatusInternalServerError)
		return
	}

	if filename != "" {
		os.Remove(r.cfg.Store.SkinPath(uuid, filename))
	}

	jsonOK(w, map[string]string{"status": "deleted"})
}
