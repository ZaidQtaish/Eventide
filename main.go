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

	http.HandleFunc("/api/items", RequireAuth(ItemsHandler))
	http.HandleFunc("/api/items/", RequireAuth(ItemsHandler))
	http.HandleFunc("/api/inventory", RequireAuth(GetInventoryHandler))
	http.HandleFunc("/api/events", RequireAuth(EventsHandler))
	http.HandleFunc("/api/daily-statements", RequireAuth(GetDailyStatementsHandler))
	http.HandleFunc("/api/login", LoginHandler)
	http.HandleFunc("/logout", LogoutHandler)
	http.HandleFunc("/api/users", RequireAuth(GetUsersHandler))
	http.HandleFunc("/api/warehouses", RequireAuth(GetWarehousesHandler))
	http.Handle("/public/", http.StripPrefix("/public/", http.FileServer(http.Dir("./public"))))
	http.Handle("/style.css", http.FileServer(http.Dir("./static")))

	loginFS := http.StripPrefix("/login/", http.FileServer(http.Dir("./static/login")))
	http.Handle("/login/", loginFS)

	appFS := http.StripPrefix("/app", http.FileServer(http.Dir("./static")))
	http.Handle("/app/", RequireAuthApp(appFS))

	http.HandleFunc("/", RootHandler)

	fmt.Println("🚀 Eventide running at http://localhost:3000")
	log.Fatal(http.ListenAndServe(":3000", nil))
}

func RootHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	if GetSessionUser(r) != "" {
		http.Redirect(w, r, "/app/", http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/login/", http.StatusSeeOther)
}

func RequireAuthApp(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if GetSessionUser(r) == "" {
			http.Redirect(w, r, "/login/", http.StatusSeeOther)
			return
		}

		next.ServeHTTP(w, r)
	})
}
