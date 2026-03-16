package db

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func Open(path string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return nil, err
	}

	sqldb, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}

	// SQLite performs best with a single writer
	sqldb.SetMaxOpenConns(1)

	database := &DB{sqldb}
	if err := database.migrate(); err != nil {
		return nil, err
	}

	return database, nil
}

func (db *DB) migrate() error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			uuid       TEXT PRIMARY KEY,
			username   TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS skins (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			uuid        TEXT NOT NULL,
			filename    TEXT NOT NULL,
			skin_type   TEXT NOT NULL DEFAULT 'classic',
			label       TEXT NOT NULL DEFAULT '',
			uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (uuid) REFERENCES users(uuid)
		);

		CREATE TABLE IF NOT EXISTS mod_preferences (
			uuid      TEXT NOT NULL,
			modpack   TEXT NOT NULL,
			mod_name  TEXT NOT NULL,
			enabled   INTEGER NOT NULL DEFAULT 1,
			PRIMARY KEY (uuid, modpack, mod_name)
		);
	`)
	return err
}

// UpsertUser creates or updates a user record.
func (db *DB) UpsertUser(uuid, username string) error {
	_, err := db.Exec(`
		INSERT INTO users (uuid, username, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(uuid) DO UPDATE SET
			username   = excluded.username,
			updated_at = CURRENT_TIMESTAMP
	`, uuid, username)
	return err
}

// GetUser returns a user by UUID.
func (db *DB) GetUser(uuid string) (string, error) {
	var username string
	err := db.QueryRow(`SELECT username FROM users WHERE uuid = ?`, uuid).Scan(&username)
	return username, err
}

// AddSkin records a newly uploaded skin.
func (db *DB) AddSkin(uuid, filename, skinType, label string) (int64, error) {
	res, err := db.Exec(`
		INSERT INTO skins (uuid, filename, skin_type, label)
		VALUES (?, ?, ?, ?)
	`, uuid, filename, skinType, label)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// GetSkins returns all skins for a user.
func (db *DB) GetSkins(uuid string) ([]Skin, error) {
	rows, err := db.Query(`
		SELECT id, filename, skin_type, label, uploaded_at
		FROM skins WHERE uuid = ?
		ORDER BY uploaded_at DESC
	`, uuid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var skins []Skin
	for rows.Next() {
		var s Skin
		if err := rows.Scan(&s.ID, &s.Filename, &s.SkinType, &s.Label, &s.UploadedAt); err != nil {
			return nil, err
		}
		skins = append(skins, s)
	}
	return skins, rows.Err()
}

// DeleteSkin removes a skin record by ID (verifying ownership).
func (db *DB) DeleteSkin(uuid string, skinID int64) error {
	_, err := db.Exec(`DELETE FROM skins WHERE id = ? AND uuid = ?`, skinID, uuid)
	return err
}

// SetModPreference saves a user's enabled/disabled state for an optional mod.
func (db *DB) SetModPreference(uuid, modpack, modName string, enabled bool) error {
	v := 0
	if enabled {
		v = 1
	}
	_, err := db.Exec(`
		INSERT INTO mod_preferences (uuid, modpack, mod_name, enabled)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(uuid, modpack, mod_name) DO UPDATE SET enabled = excluded.enabled
	`, uuid, modpack, modName, v)
	return err
}

// GetModPreferences returns the mod preferences map for a user+modpack.
func (db *DB) GetModPreferences(uuid, modpack string) (map[string]bool, error) {
	rows, err := db.Query(`
		SELECT mod_name, enabled FROM mod_preferences
		WHERE uuid = ? AND modpack = ?
	`, uuid, modpack)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	prefs := map[string]bool{}
	for rows.Next() {
		var name string
		var enabled int
		if err := rows.Scan(&name, &enabled); err != nil {
			return nil, err
		}
		prefs[name] = enabled == 1
	}
	return prefs, rows.Err()
}

type Skin struct {
	ID         int64  `json:"id"`
	Filename   string `json:"filename"`
	SkinType   string `json:"skinType"`
	Label      string `json:"label"`
	UploadedAt string `json:"uploadedAt"`
}
