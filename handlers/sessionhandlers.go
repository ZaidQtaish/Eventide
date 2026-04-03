package handlers

import (
	"encoding/json"
	"net/http"
)

func (a *App) GetSessionInfoHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	username := a.GetSessionUser(r)
	role := a.GetSessionRole(r)
	if username == "" || role == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"username": username,
		"role":     role,
	})
}
