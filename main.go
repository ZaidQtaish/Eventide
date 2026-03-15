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

	http.HandleFunc("/api/items", GetItemsHandler)

	http.HandleFunc("/inventory", GetInventoryHandler)

	// Serve UI
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	fmt.Println("🚀 Eventide running at http://localhost:3000")
	log.Fatal(http.ListenAndServe(":3000", nil))
}
