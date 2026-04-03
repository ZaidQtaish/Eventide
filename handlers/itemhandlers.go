package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

// ItemsHandler routes GET/POST for /api/items and PUT for /api/items/{id}.
func (a *App) ItemsHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/items" {
		id, err := parseItemIDFromPath(r.URL.Path)
		if err != nil {
			http.Error(w, "Invalid item id", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodPut:
			a.UpdateItemHandler(w, r, id)
			return
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	switch r.Method {
	case http.MethodGet:
		a.GetItemsHandler(w, r)
	case http.MethodPost:
		a.CreateItemHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *App) GetItemsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	rows, err := a.DB.Query(ctx, "SELECT id, sku, name, description, minimum_stock, category, supplier_id FROM items ORDER BY id")
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

	writeJSON(w, http.StatusOK, items)
}

func (a *App) CreateItemHandler(w http.ResponseWriter, r *http.Request) {
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
	err := a.DB.QueryRow(
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

	writeJSON(w, http.StatusCreated, created)
}

func (a *App) UpdateItemHandler(w http.ResponseWriter, r *http.Request, itemID int) {
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
	err := a.DB.QueryRow(
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

	writeJSON(w, http.StatusOK, updated)
}
