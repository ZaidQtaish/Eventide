package handlers

import (
	"context"
	"encoding/json"
	"net/http"
)

func (a *App) GetMostActiveHandler(w http.ResponseWriter, r *http.Request) {
	query := `
        SELECT 
            i.id,
            i.name,
            i.sku,
            COUNT(e.id) as event_count
        FROM items i
        LEFT JOIN events e ON i.id = e.item_id
        WHERE e.type = 'outbound' 
        AND e.timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY i.id, i.name, i.sku
        ORDER BY event_count DESC
        LIMIT 10
    `
	rows, err := a.DB.Query(context.Background(), query)
	if err != nil {
		http.Error(w, "Failed to fetch data", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []MostActiveItem
	for rows.Next() {
		var item MostActiveItem
		if err := rows.Scan(&item.ID, &item.Name, &item.SKU, &item.EventCount); err != nil {
			continue
		}
		items = append(items, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (a *App) GetDeadStockHandler(w http.ResponseWriter, r *http.Request) {
	query := `
        SELECT 
            i.id,
            i.name,
            i.sku,
            sn.current_quantity,
            COALESCE(
                CAST(EXTRACT(DAY FROM (NOW() - MAX(e.timestamp))) AS INTEGER),
                999
            ) as days_inactive
        FROM items i
        JOIN snapshot sn ON i.id = sn.item_id
        LEFT JOIN events e ON i.id = e.item_id AND e.type = 'outbound'
        WHERE sn.current_quantity > 0
        GROUP BY i.id, i.name, i.sku, sn.current_quantity
        HAVING MAX(e.timestamp) IS NULL OR MAX(e.timestamp) < NOW() - INTERVAL '30 days'
        ORDER BY days_inactive DESC
        LIMIT 10
    `
	rows, err := a.DB.Query(context.Background(), query)
	if err != nil {
		http.Error(w, "Failed to fetch data", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []DeadStockItem
	for rows.Next() {
		var item DeadStockItem
		if err := rows.Scan(&item.ID, &item.Name, &item.SKU, &item.CurrentQuantity, &item.DaysInactive); err != nil {
			continue
		}
		items = append(items, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (a *App) GetDemandSpikeHandler(w http.ResponseWriter, r *http.Request) {
	query := `
        SELECT 
            i.id,
            i.name,
            i.sku,
            COALESCE(
                SUM(CASE WHEN e.timestamp >= NOW() - INTERVAL '7 days' THEN e.quantity_change ELSE 0 END),
                0
            ) as recent_activity
        FROM items i
        LEFT JOIN events e ON i.id = e.item_id AND e.type = 'outbound'
        GROUP BY i.id, i.name, i.sku
        HAVING COALESCE(
                SUM(CASE WHEN e.timestamp >= NOW() - INTERVAL '7 days' THEN e.quantity_change ELSE 0 END),
                0
            ) > COALESCE(
                SUM(CASE WHEN e.timestamp >= NOW() - INTERVAL '14 days' AND e.timestamp < NOW() - INTERVAL '7 days' THEN e.quantity_change ELSE 0 END),
                0
            ) * 1.5
        ORDER BY recent_activity DESC
        LIMIT 10
    `
	rows, err := a.DB.Query(context.Background(), query)
	if err != nil {
		http.Error(w, "Failed to fetch data", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []DemandSpikeItem
	for rows.Next() {
		var item DemandSpikeItem
		if err := rows.Scan(&item.ID, &item.Name, &item.SKU, &item.RecentActivity); err != nil {
			continue
		}
		items = append(items, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}
