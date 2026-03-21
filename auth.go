package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
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

	// Query user from database
	var username, passwordHash string
	err = db.QueryRow(context.Background(),
		"SELECT username, password_hash FROM users WHERE username = $1", loginReq.Username).
		Scan(&username, &passwordHash)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(loginReq.Password))
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Create session
	sessionID, err := generateSessionID()
	if err != nil {
		http.Error(w, "Could not create session", http.StatusInternalServerError)
		return
	}

	expires := time.Now().Add(sessionDuration)
	sessionMu.Lock()
	sessionStore[sessionID] = session{Username: username, ExpiresAt: expires}
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
}

func generateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// GetSessionUser retrieves the username from a valid session cookie; returns empty string if invalid/expired
func GetSessionUser(r *http.Request) string {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return ""
	}

	sessionMu.RLock()
	sess, exists := sessionStore[cookie.Value]
	sessionMu.RUnlock()

	if !exists || sess.ExpiresAt.Before(time.Now()) {
		return ""
	}

	return sess.Username
}

// RequireAuth is middleware that checks for valid session; calls next if valid, returns 401 otherwise
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if GetSessionUser(r) == "" {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

// LogoutHandler clears the session cookie and deletes the session from store
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(sessionCookieName)
	if err == nil {
		sessionMu.Lock()
		delete(sessionStore, cookie.Value)
		sessionMu.Unlock()
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	// Redirect to login page
	http.Redirect(w, r, "/login/", http.StatusSeeOther)
}
