package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
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
	period := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("period")))
	if period == "" {
		period = "daily"
	}
	if period != "daily" && period != "monthly" {
		http.Error(w, "Invalid period (use daily or monthly)", http.StatusBadRequest)
		return
	}

	window := 7 // default 7-day window
	if period == "monthly" {
		window = 3 // default 3-month window
	}
	if windowStr != "" {
		parsedWindow, err := strconv.Atoi(windowStr)
		if err != nil || parsedWindow <= 0 || parsedWindow > 24 {
			http.Error(w, "Invalid window", http.StatusBadRequest)
			return
		}
		window = parsedWindow
	}

	now := time.Now()
	var startDate string
	var endDate string
	var forecastFor string

	if period == "monthly" {
		monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		completedMonthEnd := monthStart.AddDate(0, 0, -1)
		completedMonthStart := time.Date(completedMonthEnd.Year(), completedMonthEnd.Month(), 1, 0, 0, 0, 0, now.Location())
		startRange := completedMonthStart.AddDate(0, -(window - 1), 0)

		startDate = startRange.Format("2006-01-02")
		endDate = completedMonthEnd.Format("2006-01-02")
		forecastFor = monthStart.AddDate(0, 1, 0).Format("2006-01")
	} else {
		endDate = now.Format("2006-01-02")
		startDate = now.AddDate(0, 0, -(window - 1)).Format("2006-01-02")
		forecastFor = now.AddDate(0, 0, 1).Format("2006-01-02")
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

	// Get daily statements
	statements, err := a.getDailyStatements(ctx, startDate, endDate, itemID, warehouseCode)
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}

	// Calculate forecast from statements by selected period.
	var forecasts []MovingAverage
	if period == "monthly" {
		forecasts = calculateMonthlyMovingAverages(statements, window, now)
	} else {
		forecasts = calculateMovingAverages(statements, window)
	}

	response := ForecastResponse{
		ForecastFor: forecastFor,
		Period:      period,
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

func calculateMonthlyMovingAverages(statements []DailyStatement, window int, now time.Time) []MovingAverage {
	monthKeys := make([]string, 0, window)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	for i := 1; i <= window; i++ {
		monthKeys = append(monthKeys, monthStart.AddDate(0, -i, 0).Format("2006-01"))
	}
	monthKeySet := make(map[string]struct{}, len(monthKeys))
	for _, mk := range monthKeys {
		monthKeySet[mk] = struct{}{}
	}

	// groupKey => monthKey => totals
	grouped := make(map[string]map[string]monthlyAccumulator)
	metaByKey := make(map[string]DailyStatement)

	for _, stmt := range statements {
		monthKey := stmt.Date.Format("2006-01")
		if _, ok := monthKeySet[monthKey]; !ok {
			continue
		}

		groupKey := fmt.Sprintf("%d|%d", stmt.ItemID, stmt.WarehouseID)
		if _, ok := grouped[groupKey]; !ok {
			grouped[groupKey] = make(map[string]monthlyAccumulator)
			metaByKey[groupKey] = stmt
		}

		acc := grouped[groupKey][monthKey]
		acc.in += stmt.InQuantity
		acc.out += stmt.OutQuantity
		grouped[groupKey][monthKey] = acc
	}

	keys := make([]string, 0, len(grouped))
	for key := range grouped {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	forecasts := make([]MovingAverage, 0, len(keys))
	for _, key := range keys {
		totalsByMonth := grouped[key]
		meta := metaByKey[key]

		sumIn := 0
		sumOut := 0
		for _, monthKey := range monthKeys {
			monthTotals := totalsByMonth[monthKey]
			sumIn += monthTotals.in
			sumOut += monthTotals.out
		}

		rawAvgIn := float64(sumIn) / float64(window)
		rawAvgOut := float64(sumOut) / float64(window)

		avgIn := math.Floor(rawAvgIn)
		avgOut := math.Ceil(rawAvgOut)
		avgNet := math.Round(rawAvgIn - rawAvgOut)

		forecasts = append(forecasts, MovingAverage{
			ItemID:             meta.ItemID,
			ItemName:           meta.ItemName,
			WarehouseID:        meta.WarehouseID,
			Code:               meta.WarehouseCode,
			AverageInQuantity:  avgIn,
			AverageOutQuantity: avgOut,
			AverageNetChange:   avgNet,
		})
	}

	return forecasts
}
