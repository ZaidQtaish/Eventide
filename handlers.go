package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

// EventsHandler routes GET/POST for /events
func EventsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		GetEventsHandler(w, r)
	case http.MethodPost:
		CreateEventHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

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

func CreateEventHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	username := GetSessionUser(r)
	if username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	// Resolve user ID from username
	var userID int
	if err := db.QueryRow(ctx, "SELECT id FROM users WHERE username = $1", username).Scan(&userID); err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	eventType := strings.ToLower(strings.TrimSpace(req.EventType))
	if eventType == "" {
		http.Error(w, "type is required", http.StatusBadRequest)
		return
	}

	if req.ItemID <= 0 {
		http.Error(w, "item_id is required", http.StatusBadRequest)
		return
	}

	switch eventType {
	case "inbound", "outbound", "adjustment", "transfer":
	default:
		http.Error(w, "invalid type", http.StatusBadRequest)
		return
	}

	if req.QuantityChange == 0 {
		http.Error(w, "quantity_change must be non-zero", http.StatusBadRequest)
		return
	}

	if req.WarehouseID <= 0 {
		http.Error(w, "warehouse_id is required", http.StatusBadRequest)
		return
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		http.Error(w, "Could not start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	applyChange := func(itemID, warehouseID, delta int, typ, reason string) error {
		current := 0
		row := tx.QueryRow(ctx, "SELECT current_quantity FROM snapshot WHERE item_id = $1 AND warehouse_id = $2 FOR UPDATE", itemID, warehouseID)
		if err := row.Scan(&current); err != nil {
			if err != pgx.ErrNoRows {
				return err
			}
			current = 0
		}

		if current+delta < 0 {
			return &httpError{status: http.StatusBadRequest, msg: "insufficient stock"}
		}

		// Record event; database trigger updates snapshot
		_, err := tx.Exec(ctx, "INSERT INTO events (type, item_id, quantity_change, reason_code, user_id, warehouse_id) VALUES ($1, $2, $3, $4, $5, $6)", typ, itemID, delta, reason, userID, warehouseID)
		return err
	}

	absQty := func(v int) int {
		if v < 0 {
			return -v
		}
		return v
	}

	switch eventType {
	case "inbound":
		delta := absQty(req.QuantityChange)
		if err := applyChange(req.ItemID, req.WarehouseID, delta, eventType, req.ReasonCode); err != nil {
			writeHTTPErr(w, err)
			return
		}
	case "outbound":
		delta := -absQty(req.QuantityChange)
		if err := applyChange(req.ItemID, req.WarehouseID, delta, eventType, req.ReasonCode); err != nil {
			writeHTTPErr(w, err)
			return
		}
	case "adjustment":
		delta := req.QuantityChange
		if err := applyChange(req.ItemID, req.WarehouseID, delta, eventType, req.ReasonCode); err != nil {
			writeHTTPErr(w, err)
			return
		}
	case "transfer":
		if req.ToWarehouseID <= 0 {
			http.Error(w, "to_warehouse_id is required for transfer", http.StatusBadRequest)
			return
		}
		if req.ToWarehouseID == req.WarehouseID {
			http.Error(w, "to_warehouse_id must differ from warehouse_id", http.StatusBadRequest)
			return
		}
		qty := absQty(req.QuantityChange)
		if err := applyChange(req.ItemID, req.WarehouseID, -qty, eventType, req.ReasonCode); err != nil {
			writeHTTPErr(w, err)
			return
		}
		if err := applyChange(req.ItemID, req.ToWarehouseID, qty, eventType, req.ReasonCode); err != nil {
			writeHTTPErr(w, err)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "Could not commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// httpError conveys known error cases with HTTP status
type httpError struct {
	status int
	msg    string
}

func (e *httpError) Error() string { return e.msg }

func writeHTTPErr(w http.ResponseWriter, err error) {
	if he, ok := err.(*httpError); ok {
		http.Error(w, he.msg, he.status)
		return
	}
	http.Error(w, "Server error", http.StatusInternalServerError)
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
