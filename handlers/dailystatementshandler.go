package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

func (a *App) GetDailyStatementsHandler(w http.ResponseWriter, r *http.Request) {
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

	statements, err := a.getDailyStatements(ctx, startDate, endDate, itemID, warehouseCode)
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(statements)
}

func (a *App) getDailyStatements(ctx context.Context, startDate, endDate string, itemID *int, warehouseCode *string) ([]DailyStatement, error) {
	query := `
		SELECT
			DATE(e.timestamp) as date,
			e.item_id,
			i.name as item_name,
			e.warehouse_id,
			w.code as warehouse_code,
			COALESCE(SUM(CASE WHEN e.quantity_change > 0 THEN e.quantity_change ELSE 0 END), 0) as in_quantity,
			COALESCE(SUM(CASE WHEN e.quantity_change < 0 THEN ABS(e.quantity_change) ELSE 0 END), 0) as out_quantity
		FROM events e
		JOIN items i ON e.item_id = i.id
		JOIN warehouses w ON e.warehouse_id = w.id
		WHERE DATE(e.timestamp) >= $1 AND DATE(e.timestamp) <= $2
	`

	args := []interface{}{startDate, endDate}
	nextParam := 3

	if itemID != nil {
		query += " AND e.item_id = $3"
		args = append(args, *itemID)
		nextParam = 4
	}

	if warehouseCode != nil {
		query += fmt.Sprintf(" AND w.code = $%d", nextParam)
		args = append(args, *warehouseCode)
	}

	query += " GROUP BY DATE(e.timestamp), e.item_id, i.name, e.warehouse_id, w.code ORDER BY DATE(e.timestamp) DESC, e.item_id, w.code"

	rows, err := a.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var statements []DailyStatement
	for rows.Next() {
		var stmt DailyStatement
		if err := rows.Scan(&stmt.Date, &stmt.ItemID, &stmt.ItemName, &stmt.WarehouseID, &stmt.WarehouseCode, &stmt.InQuantity, &stmt.OutQuantity); err != nil {
			continue
		}
		stmt.NetChange = stmt.InQuantity - stmt.OutQuantity
		statements = append(statements, stmt)
	}

	return statements, nil
}
