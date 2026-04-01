package main

import (
	"context"
	"fmt"
)

// GetDailyStatements retrieves daily in/out statistics for inventory events
// Can be used by both API handlers and forecast
func GetDailyStatements(ctx context.Context, startDate, endDate string, itemID *int, warehouseCode *string) ([]DailyStatement, error) {
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

	rows, err := db.Query(ctx, query, args...)
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
