package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

const sessionCookieName = "session_token"
const sessionDuration = 12 * time.Hour

var (
	sessionStore = make(map[string]session)
	sessionMu    sync.RWMutex
)

// LoginHandler handles user login requests
func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var loginReq LoginRequest
	err := json.NewDecoder(r.Body).Decode(&loginReq)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	//
	if loginReq.Username == "admin" && loginReq.Password == "admin" {
		sessionID, err := generateSessionID()
		if err != nil {
			http.Error(w, "Could not create session", http.StatusInternalServerError)
			return
		}

		expires := time.Now().Add(sessionDuration)
		sessionMu.Lock()
		sessionStore[sessionID] = session{Username: loginReq.Username, ExpiresAt: expires}
		sessionMu.Unlock()

		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    sessionID,
			Path:     "/",
			Expires:  expires,
			MaxAge:   int(sessionDuration.Seconds()),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   false,
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	} else {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
	}

}

func generateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
