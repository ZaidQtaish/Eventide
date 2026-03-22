package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
)

// GetItemsHandler retrieves all items from the database
func GetItemsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	rows, err := db.Query(ctx, "SELECT id, sku, name FROM items")
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
		SELECT s.item_id, i.name, i.sku, i.minimum_stock, s.current_quantity, s.warehouse_id, w.code, s.last_updated
		FROM snapshot s
		JOIN items i ON s.item_id = i.id
		JOIN warehouses w ON s.warehouse_id = w.id
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
		if err := rows.Scan(&inv.ItemID, &inv.Name, &inv.SKU, &inv.MinimumQuantity, &inv.CurrentQuantity, &inv.WarehouseID, &inv.WarehouseCode, &inv.LastUpdated); err != nil {
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
		SELECT e.id, e.item_id, e.user_id, i.name, u.username, e.warehouse_id, w.code, e.type, e.reason_code, e.quantity_change, e.timestamp
		FROM events e
		JOIN items i ON e.item_id = i.id
		JOIN users u ON e.user_id = u.id
		JOIN warehouses w ON e.warehouse_id = w.id
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
		if err := rows.Scan(&evt.EventID, &evt.ItemID, &evt.UserID, &evt.ItemName, &evt.Username, &evt.WarehouseID, &evt.WarehouseCode, &evt.EventType, &evt.ReasonCode, &evt.QuantityChange, &evt.Timestamp); err != nil {
			continue
		}
		events = append(events, evt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func GetDailyStatementsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	itemIDStr := r.URL.Query().Get("item_id")

	if startDate == "" || endDate == "" {
		http.Error(w, "start_date and end_date parameters are required", http.StatusBadRequest)
		return
	}

	var itemID *int
	if itemIDStr != "" {
		id, err := strconv.Atoi(itemIDStr)
		if err != nil {
			http.Error(w, "Invalid item_id", http.StatusBadRequest)
			return
		}
		itemID = &id
	}

	statements, err := GetDailyStatements(ctx, startDate, endDate, itemID)
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(statements)
}
