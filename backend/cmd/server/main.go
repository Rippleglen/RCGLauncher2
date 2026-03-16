package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/rippleglen/rcg-backend/internal/api"
	"github.com/rippleglen/rcg-backend/internal/db"
	"github.com/rippleglen/rcg-backend/internal/store"
)

// Version: includes /admin/ping endpoint for key validation.
func main() {
	cfg := config()

	database, err := db.Open(cfg.dataDir + "/launcher.db")
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer database.Close()

	fileStore := store.New(cfg.dataDir)

	router := api.NewRouter(api.Config{
		DB:       database,
		Store:    fileStore,
		AdminKey: cfg.adminKey,
		BaseURL:  cfg.baseURL,
	})

	addr := fmt.Sprintf(":%s", cfg.port)
	log.Printf("RCG backend listening on %s", addr)
	log.Printf("Data directory: %s", cfg.dataDir)

	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

type appConfig struct {
	port     string
	dataDir  string
	adminKey string
	baseURL  string
}

func config() appConfig {
	return appConfig{
		port:     getEnv("PORT", "8080"),
		dataDir:  getEnv("DATA_DIR", "./data"),
		adminKey: getEnv("ADMIN_KEY", ""),
		baseURL:  getEnv("BASE_URL", "http://localhost:8080"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
