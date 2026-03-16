package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func (r *router) listModpacks(w http.ResponseWriter, req *http.Request) {
	packs, err := r.cfg.Store.ListModpacks()
	if err != nil {
		jsonError(w, "failed to list modpacks", http.StatusInternalServerError)
		return
	}
	jsonOK(w, packs)
}

func (r *router) getModpack(w http.ResponseWriter, req *http.Request) {
	name := chi.URLParam(req, "name")
	meta, err := r.cfg.Store.ReadModpackMeta(name)
	if err != nil {
		jsonError(w, "modpack not found", http.StatusNotFound)
		return
	}
	jsonOK(w, meta)
}
