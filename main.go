package main

import (
	"fmt"
	"log"
	"net/http"
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
		// Allow login and static assets under /login and /static
		if r.URL.Path == "/login/" || r.URL.Path == "/login/index.html" ||
			r.URL.Path == "/login/login.js" || r.URL.Path == "/style.css" {
			next.ServeHTTP(w, r)
			return
		}

		// For dashboard paths, check auth
		if GetSessionUser(r) == "" {
			http.Redirect(w, r, "/login/", http.StatusSeeOther)
			return
		}

		next.ServeHTTP(w, r)
	}
}
