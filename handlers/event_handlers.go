package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

// EventsHandler routes GET/POST for /api/events.
func (a *App) EventsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.GetEventsHandler(w, r)
	case http.MethodPost:
		a.CreateEventHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *App) GetInventoryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	query := `
		SELECT s.item_id, i.name, i.sku, i.minimum_stock, s.current_quantity, s.warehouse_id, w.code, s.last_updated
		FROM snapshot s
		JOIN items i ON s.item_id = i.id
		JOIN warehouses w ON s.warehouse_id = w.id
		ORDER BY s.item_id
	`

	rows, err := a.DB.Query(ctx, query)
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

	writeJSON(w, http.StatusOK, inventory)
}

func (a *App) GetEventsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	query := `
		SELECT e.id, e.item_id, e.user_id, i.name, i.sku, u.username, e.warehouse_id, w.code, e.type, e.reason_code, e.quantity_change, e.timestamp
		FROM events e
		JOIN items i ON e.item_id = i.id
		JOIN users u ON e.user_id = u.id
		JOIN warehouses w ON e.warehouse_id = w.id
		ORDER BY e.timestamp DESC
	`

	rows, err := a.DB.Query(ctx, query)
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var evt Event
		if err := rows.Scan(&evt.EventID, &evt.ItemID, &evt.UserID, &evt.ItemName, &evt.SKU, &evt.Username, &evt.WarehouseID, &evt.WarehouseCode, &evt.EventType, &evt.ReasonCode, &evt.QuantityChange, &evt.Timestamp); err != nil {
			continue
		}
		events = append(events, evt)
	}

	writeJSON(w, http.StatusOK, events)
}

func (a *App) CreateEventHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	username := a.GetSessionUser(r)
	if username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	userID, err := a.lookupUserID(ctx, username)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	plan, err := validateAndPlanEvent(req)
	if err != nil {
		writeHTTPErr(w, err)
		return
	}

	tx, err := a.DB.Begin(ctx)
	if err != nil {
		http.Error(w, "Could not start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	for _, m := range plan.mutations {
		if err := applyEventMutation(ctx, tx, m, userID); err != nil {
			writeHTTPErr(w, err)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "Could not commit transaction", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "ok"})
}

func (a *App) lookupUserID(ctx context.Context, username string) (int, error) {
	var userID int
	if err := a.DB.QueryRow(ctx, "SELECT id FROM users WHERE username = $1", username).Scan(&userID); err != nil {
		return 0, err
	}
	return userID, nil
}

func validateAndPlanEvent(req CreateEventRequest) (eventPlan, error) {
	eventType := strings.ToLower(strings.TrimSpace(req.EventType))
	if eventType == "" {
		return eventPlan{}, &httpError{status: http.StatusBadRequest, msg: "type is required"}
	}

	if req.ItemID <= 0 {
		return eventPlan{}, &httpError{status: http.StatusBadRequest, msg: "item_id is required"}
	}

	if req.QuantityChange == 0 {
		return eventPlan{}, &httpError{status: http.StatusBadRequest, msg: "quantity_change must be non-zero"}
	}

	if req.WarehouseID <= 0 {
		return eventPlan{}, &httpError{status: http.StatusBadRequest, msg: "warehouse_id is required"}
	}

	absQty := req.QuantityChange
	if absQty < 0 {
		absQty = -absQty
	}

	switch eventType {
	case "inbound":
		return eventPlan{mutations: []eventMutation{{
			itemID:      req.ItemID,
			warehouseID: req.WarehouseID,
			delta:       absQty,
			eventType:   eventType,
			reason:      req.ReasonCode,
		}}}, nil
	case "outbound":
		return eventPlan{mutations: []eventMutation{{
			itemID:      req.ItemID,
			warehouseID: req.WarehouseID,
			delta:       -absQty,
			eventType:   eventType,
			reason:      req.ReasonCode,
		}}}, nil
	case "adjustment":
		return eventPlan{mutations: []eventMutation{{
			itemID:      req.ItemID,
			warehouseID: req.WarehouseID,
			delta:       req.QuantityChange,
			eventType:   eventType,
			reason:      req.ReasonCode,
		}}}, nil
	default:
		return eventPlan{}, &httpError{status: http.StatusBadRequest, msg: "invalid type"}
	}
}

func applyEventMutation(ctx context.Context, tx pgx.Tx, m eventMutation, userID int) error {
	current := 0
	row := tx.QueryRow(ctx, "SELECT current_quantity FROM snapshot WHERE item_id = $1 AND warehouse_id = $2 FOR UPDATE", m.itemID, m.warehouseID)
	if err := row.Scan(&current); err != nil {
		if err != pgx.ErrNoRows {
			return err
		}
		current = 0
	}

	if current+m.delta < 0 {
		return &httpError{status: http.StatusBadRequest, msg: "insufficient stock"}
	}

	_, err := tx.Exec(ctx, "INSERT INTO events (type, item_id, quantity_change, reason_code, user_id, warehouse_id) VALUES ($1, $2, $3, $4, $5, $6)", m.eventType, m.itemID, m.delta, m.reason, userID, m.warehouseID)
	return err
}
