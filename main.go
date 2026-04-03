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
	http.HandleFunc("/api/session", RequireAuth(GetSessionInfoHandler))
	http.HandleFunc("/api/login", LoginHandler)
	http.HandleFunc("/logout", LogoutHandler)
	http.HandleFunc("/api/users", RequireAuth(UsersHandler))
	http.HandleFunc("/api/warehouses", RequireAuth(GetWarehousesHandler))
	http.Handle("/public/", http.StripPrefix("/public/", http.FileServer(http.Dir("./public"))))
	http.Handle("/style.css", http.FileServer(http.Dir("./static")))

	loginFS := http.StripPrefix("/login/", http.FileServer(http.Dir("./static/login")))
	http.Handle("/login/", loginFS)

	http.Handle("/app/", RequireAuthApp(http.HandlerFunc(AppHandler)))

	http.HandleFunc("/", RootHandler)

	fmt.Println("🚀 Eventide running at http://localhost:3000")
	log.Fatal(http.ListenAndServe(":3000", nil))
}

func RootHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	http.ServeFile(w, r, "./static/index.html")
}

func AppHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/app/" {
		http.ServeFile(w, r, "./static/dashboard.html")
		return
	}

	appFS := http.StripPrefix("/app", http.FileServer(http.Dir("./static")))
	appFS.ServeHTTP(w, r)
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
