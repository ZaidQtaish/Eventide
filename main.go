package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5"
)

type Item struct {
	ID   int    `json:"item_id"`
	SKU  string `json:"sku"`
	Name string `json:"name"`
}

func main() {
	// Database connection string
	connStr := "postgres://postgres@localhost:5432/logistock"

	http.HandleFunc("/api/items", func(w http.ResponseWriter, r *http.Request) {
		conn, _ := pgx.Connect(context.Background(), connStr)
		defer conn.Close(context.Background())

		rows, _ := conn.Query(context.Background(), "SELECT item_id, sku, name FROM items")
		var items []Item
		for rows.Next() {
			var i Item
			rows.Scan(&i.ID, &i.SKU, &i.Name)
			items = append(items, i)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	})

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)
	fmt.Println("Server started at http://localhost:8080")
	http.ListenAndServe(":8080", nil)
}
