package main

import (
	"context"
	"encoding/json"
	"net/http"
)

// GetItemsHandler retrieves all items from the database
func GetItemsHandler(w http.ResponseWriter, r *http.Request) {
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
}

func GetInventoryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	query := `
		SELECT s.item_id, i.name, s.current_quantity, s.last_updated
		FROM snapshot s
		JOIN items i ON s.item_id = i.item_id
		ORDER BY s.item_id
	`

	rows, err := db.Query(ctx, query)
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var inventory []Inventory
	for rows.Next() {
		var inv Inventory
		if err := rows.Scan(&inv.ItemID, &inv.Name, &inv.CurrentQuantity, &inv.LastUpdated); err != nil {
			continue
		}
		inventory = append(inventory, inv)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(inventory)
}
