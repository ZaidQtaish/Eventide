package main

import (
	"context"
	"encoding/json"
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

	http.HandleFunc("/items", func(w http.ResponseWriter, r *http.Request) {
		ctx := context.Background()

		rows, err := db.Query(ctx, "SELECT item_id, sku, name FROM items")
		if err != nil {
			http.Error(w, "Query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var items []Item
		for rows.Next() {
			var i Item
			if err := rows.Scan(&i.ID, &i.SKU, &i.Name); err != nil {
				continue
			}
			items = append(items, i)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	})

	// Serve UI
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	fmt.Println("🚀 Eventide running at http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
