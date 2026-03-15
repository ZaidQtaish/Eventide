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

func GetEventsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	query := `
		SELECT e.event_id, e.item_id, e.user_id, i.name, u.username, e.event_type, e.reason_code, e.quantity_change, e.timestamp
		FROM inventory_events e
		JOIN items i ON e.item_id = i.item_id
		JOIN users u ON e.user_id = u.user_id
		ORDER BY e.timestamp DESC
	`

	rows, err := db.Query(ctx, query)
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var evt Event
		if err := rows.Scan(&evt.EventID, &evt.ItemID, &evt.UserID, &evt.ItemName, &evt.Username, &evt.EventType, &evt.ReasonCode, &evt.QuantityChange, &evt.Timestamp); err != nil {
			continue
		}
		events = append(events, evt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}
