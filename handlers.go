package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// ItemsHandler routes GET/POST for /items
func ItemsHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/items" {
		id, err := parseItemIDFromPath(r.URL.Path)
		if err != nil {
			http.Error(w, "Invalid item id", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodPut:
			UpdateItemHandler(w, r, id)
			return
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	switch r.Method {
	case http.MethodGet:
		GetItemsHandler(w, r)
	case http.MethodPost:
		CreateItemHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func parseItemIDFromPath(path string) (int, error) {
	const prefix = "/api/items/"
	if !strings.HasPrefix(path, prefix) {
		return 0, strconv.ErrSyntax
	}

	itemIDPart := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if itemIDPart == "" || strings.Contains(itemIDPart, "/") {
		return 0, strconv.ErrSyntax
	}

	return strconv.Atoi(itemIDPart)
}

func parseUserIDFromPath(path string) (int, error) {
	const prefix = "/api/users/"
	if !strings.HasPrefix(path, prefix) {
		return 0, strconv.ErrSyntax
	}

	userIDPart := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if userIDPart == "" || strings.Contains(userIDPart, "/") {
		return 0, strconv.ErrSyntax
	}

	return strconv.Atoi(userIDPart)
}

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

	rows, err := db.Query(ctx, "SELECT id, sku, name, description, minimum_stock, category, supplier_id FROM items ORDER BY id")
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var i Item
		if err := rows.Scan(&i.ID, &i.SKU, &i.Name, &i.Description, &i.MinimumStock, &i.Category, &i.SupplierID); err != nil {
			continue
		}
		items = append(items, i)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func CreateItemHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	sku := strings.TrimSpace(req.SKU)
	description := strings.TrimSpace(req.Description)
	category := strings.TrimSpace(req.Category)

	if name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	if sku == "" {
		http.Error(w, "sku is required", http.StatusBadRequest)
		return
	}

	minimumStock := 10
	if req.MinimumStock != nil {
		minimumStock = *req.MinimumStock
	}

	if minimumStock < 0 {
		http.Error(w, "minimum_stock cannot be negative", http.StatusBadRequest)
		return
	}

	var supplierID any
	if req.SupplierID != nil {
		if *req.SupplierID <= 0 {
			http.Error(w, "supplier_id must be positive", http.StatusBadRequest)
			return
		}
		supplierID = *req.SupplierID
	}

	ctx := r.Context()
	var created Item
	err := db.QueryRow(
		ctx,
		"INSERT INTO items (name, sku, description, minimum_stock, category, supplier_id) VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6) RETURNING id, sku, name, description, minimum_stock, category, supplier_id",
		name,
		sku,
		description,
		minimumStock,
		category,
		supplierID,
	).Scan(&created.ID, &created.SKU, &created.Name, &created.Description, &created.MinimumStock, &created.Category, &created.SupplierID)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
			http.Error(w, "sku already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Insert failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func UpdateItemHandler(w http.ResponseWriter, r *http.Request, itemID int) {
	if itemID <= 0 {
		http.Error(w, "Invalid item id", http.StatusBadRequest)
		return
	}

	var req CreateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	sku := strings.TrimSpace(req.SKU)
	description := strings.TrimSpace(req.Description)
	category := strings.TrimSpace(req.Category)

	if name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	if sku == "" {
		http.Error(w, "sku is required", http.StatusBadRequest)
		return
	}

	minimumStock := 10
	if req.MinimumStock != nil {
		minimumStock = *req.MinimumStock
	}

	if minimumStock < 0 {
		http.Error(w, "minimum_stock cannot be negative", http.StatusBadRequest)
		return
	}

	var supplierID any
	if req.SupplierID != nil {
		if *req.SupplierID <= 0 {
			http.Error(w, "supplier_id must be positive", http.StatusBadRequest)
			return
		}
		supplierID = *req.SupplierID
	}

	ctx := r.Context()
	var updated Item
	err := db.QueryRow(
		ctx,
		"UPDATE items SET name = $1, sku = $2, description = NULLIF($3, ''), minimum_stock = $4, category = NULLIF($5, ''), supplier_id = $6 WHERE id = $7 RETURNING id, sku, name, description, minimum_stock, category, supplier_id",
		name,
		sku,
		description,
		minimumStock,
		category,
		supplierID,
		itemID,
	).Scan(&updated.ID, &updated.SKU, &updated.Name, &updated.Description, &updated.MinimumStock, &updated.Category, &updated.SupplierID)
	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "item not found", http.StatusNotFound)
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
			http.Error(w, "sku already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Update failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
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
		SELECT e.id, e.item_id, e.user_id, i.name, i.sku, u.username, e.warehouse_id, w.code, e.type, e.reason_code, e.quantity_change, e.timestamp
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
		if err := rows.Scan(&evt.EventID, &evt.ItemID, &evt.UserID, &evt.ItemName, &evt.SKU, &evt.Username, &evt.WarehouseID, &evt.WarehouseCode, &evt.EventType, &evt.ReasonCode, &evt.QuantityChange, &evt.Timestamp); err != nil {
			continue
		}
		events = append(events, evt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func CreateEventHandler(w http.ResponseWriter, r *http.Request) {
	// Error handling and validation are done in validateAndPlanEvent; stock checks and DB mutations in applyEventMutation.
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

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
	userID, err := lookupUserID(ctx, username)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	plan, err := validateAndPlanEvent(req)
	if err != nil {
		writeHTTPErr(w, err)
		return
	}

	tx, err := db.Begin(ctx)
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// lookupUserID resolves a username to its database id.
func lookupUserID(ctx context.Context, username string) (int, error) {
	var userID int
	if err := db.QueryRow(ctx, "SELECT id FROM users WHERE username = $1", username).Scan(&userID); err != nil {
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

// applyEventMutation checks stock level then inserts event row; snapshot updates via DB trigger.
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
	warehouseCodeRaw := strings.TrimSpace(r.URL.Query().Get("warehouse_code"))

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

	var warehouseCode *string
	if warehouseCodeRaw != "" {
		warehouseCode = &warehouseCodeRaw
	}

	statements, err := GetDailyStatements(ctx, startDate, endDate, itemID, warehouseCode)
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(statements)
}

func GetSessionInfoHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	username := GetSessionUser(r)
	role := GetSessionRole(r)
	if username == "" || role == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"username": username,
		"role":     role,
	})
}

func GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := context.Background()

	rows, err := db.Query(ctx, "SELECT id, username, name, role, COALESCE(phone_number, '') FROM users ORDER BY username")
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.PhoneNumber); err != nil {
			continue
		}
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func GetWarehousesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := context.Background()

	rows, err := db.Query(ctx, "SELECT code, status FROM warehouses ORDER BY code")
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var warehouses []Warehouse
	for rows.Next() {
		var wHouse Warehouse
		if err := rows.Scan(&wHouse.Code, &wHouse.Status); err != nil {
			continue
		}
		warehouses = append(warehouses, wHouse)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(warehouses)
}

func CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	// Check if user is admin
	userRole := GetSessionRole(r)
	if userRole != "admin" {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, "Only admins can create users", http.StatusForbidden)
		return
	}

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate input
	username := strings.TrimSpace(req.Username)
	password := strings.TrimSpace(req.Password)
	name := strings.TrimSpace(req.Name)
	role := strings.TrimSpace(req.Role)

	if username == "" || password == "" || name == "" || role == "" {
		http.Error(w, "Missing required fields: username, password, name, role", http.StatusBadRequest)
		return
	}

	if len(password) < 6 {
		http.Error(w, "Password must be at least 6 characters", http.StatusBadRequest)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Password hashing failed", http.StatusInternalServerError)
		return
	}

	// Insert into database
	ctx := r.Context()
	var createdUser User

	err = db.QueryRow(
		ctx,
		"INSERT INTO users (username, password_hash, name, role, phone_number) VALUES ($1, $2, $3, $4, NULLIF($5, '')) RETURNING id, username, name, role, COALESCE(phone_number, '')",
		username,
		string(hashedPassword),
		name,
		role,
		strings.TrimSpace(req.PhoneNumber),
	).Scan(&createdUser.ID, &createdUser.Username, &createdUser.Name, &createdUser.Role, &createdUser.PhoneNumber)

	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdUser)
}

func UsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/users" {
		id, err := parseUserIDFromPath(r.URL.Path)
		if err != nil {
			http.Error(w, "Invalid user id", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodPut:
			UpdateUserHandler(w, r, id)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	switch r.Method {
	case http.MethodGet:
		GetUsersHandler(w, r)
	case http.MethodPost:
		CreateUserHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func UpdateUserHandler(w http.ResponseWriter, r *http.Request, userID int) {
	if userID <= 0 {
		http.Error(w, "Invalid user id", http.StatusBadRequest)
		return
	}

	if GetSessionRole(r) != "admin" {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, "Only admins can update users", http.StatusForbidden)
		return
	}

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	username := strings.TrimSpace(req.Username)
	name := strings.TrimSpace(req.Name)
	role := strings.TrimSpace(req.Role)
	phone := strings.TrimSpace(req.PhoneNumber)
	password := strings.TrimSpace(req.Password)

	if username == "" || name == "" || role == "" {
		http.Error(w, "Missing required fields: username, name, role", http.StatusBadRequest)
		return
	}

	if password != "" && len(password) < 6 {
		http.Error(w, "Password must be at least 6 characters", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var updatedUser User

	if password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Password hashing failed", http.StatusInternalServerError)
			return
		}

		err = db.QueryRow(
			ctx,
			"UPDATE users SET username = $1, name = $2, role = $3, phone_number = NULLIF($4, ''), password_hash = $5 WHERE id = $6 RETURNING id, username, name, role, COALESCE(phone_number, '')",
			username,
			name,
			role,
			phone,
			string(hashedPassword),
			userID,
		).Scan(&updatedUser.ID, &updatedUser.Username, &updatedUser.Name, &updatedUser.Role, &updatedUser.PhoneNumber)
		if err != nil {
			if err == pgx.ErrNoRows {
				http.Error(w, "user not found", http.StatusNotFound)
				return
			}
			if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
				http.Error(w, "Username already exists", http.StatusConflict)
				return
			}
			http.Error(w, "Failed to update user", http.StatusInternalServerError)
			return
		}
	} else {
		err := db.QueryRow(
			ctx,
			"UPDATE users SET username = $1, name = $2, role = $3, phone_number = NULLIF($4, '') WHERE id = $5 RETURNING id, username, name, role, COALESCE(phone_number, '')",
			username,
			name,
			role,
			phone,
			userID,
		).Scan(&updatedUser.ID, &updatedUser.Username, &updatedUser.Name, &updatedUser.Role, &updatedUser.PhoneNumber)
		if err != nil {
			if err == pgx.ErrNoRows {
				http.Error(w, "user not found", http.StatusNotFound)
				return
			}
			if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
				http.Error(w, "Username already exists", http.StatusConflict)
				return
			}
			http.Error(w, "Failed to update user", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedUser)
}
