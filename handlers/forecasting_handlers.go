package handlers

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (a *App) GetForecastHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	itemIDStr := r.URL.Query().Get("item_id")
	warehouseCodeRaw := strings.TrimSpace(r.URL.Query().Get("warehouse_code"))
	windowStr := r.URL.Query().Get("window")

	window := 7 // default 7-day moving average
	if windowStr != "" {
		parsedWindow, err := strconv.Atoi(windowStr)
		if err != nil || parsedWindow <= 0 {
			http.Error(w, "Invalid window", http.StatusBadRequest)
			return
		}
		window = parsedWindow
	}

	endDate := time.Now().Format("2006-01-02")
	startDate := time.Now().AddDate(0, 0, -(window - 1)).Format("2006-01-02")

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

	// Get daily statements
	statements, err := a.getDailyStatements(ctx, startDate, endDate, itemID, warehouseCode)
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}

	// Calculate moving averages from statements
	forecasts := calculateMovingAverages(statements, window)
	response := ForecastResponse{
		ForecastFor: time.Now().AddDate(0, 0, 1).Format("2006-01-02"),
		Window:      window,
		Forecasts:   forecasts,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// calculateMovingAverages computes moving averages for inbound and outbound quantities.
func calculateMovingAverages(statements []DailyStatement, window int) []MovingAverage {
	// Group statements by item and warehouse
	grouped := make(map[string][]DailyStatement)
	for _, stmt := range statements {
		key := stmt.ItemName + "|" + stmt.WarehouseCode
		grouped[key] = append(grouped[key], stmt)
	}

	var forecasts []MovingAverage
	for _, stmts := range grouped {
		if len(stmts) == 0 {
			continue
		}

		// Calculate simple moving averages for in/out, then derive net.
		sumIn := 0
		sumOut := 0
		count := 0
		for _, stmt := range stmts {
			if count < window {
				sumIn += stmt.InQuantity
				sumOut += stmt.OutQuantity
				count++
			}
		}

		var avgIn float64
		var avgOut float64
		var avgNet float64
		if count > 0 {
			rawAvgIn := float64(sumIn) / float64(count)
			rawAvgOut := float64(sumOut) / float64(count)

			avgIn = math.Floor(rawAvgIn)
			avgOut = math.Ceil(rawAvgOut)
			avgNet = math.Round(rawAvgIn - rawAvgOut)
		}

		forecasts = append(forecasts, MovingAverage{
			ItemID:             stmts[0].ItemID,
			ItemName:           stmts[0].ItemName,
			WarehouseID:        stmts[0].WarehouseID,
			Code:               stmts[0].WarehouseCode,
			AverageInQuantity:  avgIn,
			AverageOutQuantity: avgOut,
			AverageNetChange:   avgNet,
		})
	}

	return forecasts
}
