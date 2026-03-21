package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"
)

func main() {
	// Initialize database connection pool
	err := InitDB()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer CloseDB()

	http.HandleFunc("/items", RequireAuth(GetItemsHandler))
	http.HandleFunc("/inventory", RequireAuth(GetInventoryHandler))
	http.HandleFunc("/events", RequireAuth(GetEventsHandler))
	http.HandleFunc("/daily-statements", RequireAuth(GetDailyStatementsHandler))
	http.HandleFunc("/login", LoginHandler)
	http.HandleFunc("/logout", LogoutHandler)
	// Serve UI
	fs := http.FileServer(http.Dir("./static"))
	http.HandleFunc("/", RequireAuthPage(fs))

	fmt.Println("🚀 Eventide running at http://localhost:3000")
	log.Fatal(http.ListenAndServe(":3000", nil))
}

// RequireAuthPage wraps a file server and redirects to login if not authenticated
func RequireAuthPage(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Allow login pages and static assets without auth
		if strings.HasPrefix(path, "/login/") ||
			ends(path, ".css") || ends(path, ".js") ||
			ends(path, ".png") || ends(path, ".jpg") || ends(path, ".svg") {
			next.ServeHTTP(w, r)
			return
		}

		// Require auth for everything else
		if GetSessionUser(r) == "" {
			http.Redirect(w, r, "/login/", http.StatusSeeOther)
			return
		}

		next.ServeHTTP(w, r)
	}
}

// Helper function to check if string ends with suffix
func ends(s, suffix string) bool {
	return len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix
}
