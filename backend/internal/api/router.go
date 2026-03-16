package api

import (
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rippleglen/rcg-backend/internal/db"
	"github.com/rippleglen/rcg-backend/internal/store"
)

// Config holds dependencies for all handlers.
type Config struct {
	DB       *db.DB
	Store    *store.Store
	AdminKey string
	BaseURL  string
}

// syncToken holds a pending update for a client to download.
type syncToken struct {
	modpack   string
	diff      *store.SyncDiff
	expiresAt time.Time
}

type router struct {
	cfg    Config
	tokens map[string]syncToken
	mu     sync.Mutex
}

func NewRouter(cfg Config) http.Handler {
	r := &router{
		cfg:    cfg,
		tokens: map[string]syncToken{},
	}

	// Periodically clean up expired tokens
	go r.cleanTokens()

	mux := chi.NewRouter()
	mux.Use(middleware.Logger)
	mux.Use(middleware.Recoverer)
	mux.Use(middleware.SetHeader("Content-Type", "application/json"))

	// Public endpoints
	mux.Get("/modpacks", r.listModpacks)
	mux.Get("/modpacks/{name}", r.getModpack)

	mux.Post("/sync/{name}", r.syncCheck)
	mux.Get("/sync/{name}/download/{token}", r.syncDownload)

	mux.Post("/skins/upload", r.uploadSkin)
	mux.Get("/skins/{uuid}/{filename}", r.serveSkin)
	mux.Get("/users/{uuid}/skins", r.listSkins)
	mux.Delete("/users/{uuid}/skins/{id}", r.deleteSkin)

	mux.Get("/users/{uuid}", r.getUser)
	mux.Put("/users/{uuid}", r.upsertUser)
	mux.Get("/users/{uuid}/mods/{modpack}", r.getModPrefs)
	mux.Put("/users/{uuid}/mods/{modpack}", r.setModPrefs)

	// Admin endpoints — require ADMIN_KEY header
	mux.Group(func(mux chi.Router) {
		mux.Use(r.requireAdmin)
		mux.Post("/admin/modpacks", r.adminCreateModpack)
		mux.Put("/admin/modpacks/{name}", r.adminUpdateModpack)
		mux.Post("/admin/modpacks/{name}/push", r.adminPushFiles)
		mux.Post("/admin/modpacks/{name}/regenerate", r.adminRegenerateManifest)
		mux.Delete("/admin/modpacks/{name}", r.adminDeleteModpack)
	})

	return mux
}

func (r *router) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if r.cfg.AdminKey == "" {
			jsonError(w, "admin key not configured", http.StatusServiceUnavailable)
			return
		}
		key := req.Header.Get("X-Admin-Key")
		if key == "" {
			key = req.Header.Get("Authorization")
			if len(key) > 7 && key[:7] == "Bearer " {
				key = key[7:]
			}
		}
		if key != r.cfg.AdminKey {
			jsonError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, req)
	})
}

func (r *router) cleanTokens() {
	for range time.Tick(time.Minute) {
		r.mu.Lock()
		for k, t := range r.tokens {
			if time.Now().After(t.expiresAt) {
				delete(r.tokens, k)
			}
		}
		r.mu.Unlock()
	}
}
