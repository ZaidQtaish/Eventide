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
	http.Handle("/", fs)

	fmt.Println("🚀 Eventide running at http://localhost:3000")
	log.Fatal(http.ListenAndServe(":3000", nil))
}
