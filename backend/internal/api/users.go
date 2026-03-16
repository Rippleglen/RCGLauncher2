package api

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// getUser returns a user's profile.
// GET /users/{uuid}
func (r *router) getUser(w http.ResponseWriter, req *http.Request) {
	uuid := chi.URLParam(req, "uuid")
	username, err := r.cfg.DB.GetUser(uuid)
	if err == sql.ErrNoRows {
		jsonError(w, "user not found", http.StatusNotFound)
		return
	}
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"uuid": uuid, "username": username})
}

// upsertUser creates or updates a user record.
// PUT /users/{uuid}
func (r *router) upsertUser(w http.ResponseWriter, req *http.Request) {
	uuid := chi.URLParam(req, "uuid")

	var body struct {
		Username string `json:"username"`
	}
	if err := decodeJSON(req, &body); err != nil || body.Username == "" {
		jsonError(w, "username required", http.StatusBadRequest)
		return
	}

	if err := r.cfg.DB.UpsertUser(uuid, body.Username); err != nil {
		jsonError(w, "failed to update user", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

// getModPrefs returns a user's optional mod selections for a modpack.
// GET /users/{uuid}/mods/{modpack}
func (r *router) getModPrefs(w http.ResponseWriter, req *http.Request) {
	uuid := chi.URLParam(req, "uuid")
	modpack := chi.URLParam(req, "modpack")

	prefs, err := r.cfg.DB.GetModPreferences(uuid, modpack)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, prefs)
}

// setModPrefs saves a user's optional mod selections for a modpack.
// PUT /users/{uuid}/mods/{modpack}
// Body: {"sodium": true, "optifine": false}
func (r *router) setModPrefs(w http.ResponseWriter, req *http.Request) {
	uuid := chi.URLParam(req, "uuid")
	modpack := chi.URLParam(req, "modpack")

	var prefs map[string]bool
	if err := decodeJSON(req, &prefs); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	for modName, enabled := range prefs {
		if err := r.cfg.DB.SetModPreference(uuid, modpack, modName, enabled); err != nil {
			jsonError(w, "failed to save preferences", http.StatusInternalServerError)
			return
		}
	}
	jsonOK(w, map[string]string{"status": "ok"})
}
