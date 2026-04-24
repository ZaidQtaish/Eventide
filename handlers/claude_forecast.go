package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"time"
)

func forecastKey(itemID, warehouseID int) string {
	return fmt.Sprintf("%d|%d", itemID, warehouseID)
}

func generateClaudeNetForecast(ctx context.Context, period, forecastFor string, window int, forecasts []MovingAverage) (map[string]float64, error) {
	fmt.Println("[DEBUG] generateClaudeNetForecast called")
	apiKey := strings.TrimSpace(os.Getenv("GITHUB_API_KEY"))
	if apiKey == "" || len(forecasts) == 0 {
		fmt.Printf("[DEBUG] Early return: apiKey empty=%v, forecasts empty=%v\n", apiKey == "", len(forecasts) == 0)
		return nil, nil
	}

	model := strings.TrimSpace(os.Getenv("GITHUB_MODEL"))
	if model == "" {
		model = "gpt-4o"
	}

	input := make([]map[string]any, 0, len(forecasts))
	for _, row := range forecasts {
		input = append(input, map[string]any{
			"item_id":              row.ItemID,
			"item_name":            row.ItemName,
			"warehouse_id":         row.WarehouseID,
			"warehouse_code":       row.Code,
			"average_in_quantity":  row.AverageInQuantity,
			"average_out_quantity": row.AverageOutQuantity,
			"average_net_change":   row.AverageNetChange,
		})
	}

	inputJSON, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}

	prompt := fmt.Sprintf(
		"You are assisting inventory forecasting. Return ONLY strict JSON array with objects: item_id (int), warehouse_id (int), ai_forecast_net (number).\n"+
			"Do not include markdown, comments, or extra keys.\n"+
			"Context: period=%s, forecast_for=%s, window=%d.\n"+
			"For each row, the baseline forecast is the 'average_net_change' value.\n"+
			"YOUR FORECAST ai_forecast_net should be within ±50%% of the baseline average_net_change.\n"+
			"Example: if average_net_change is 100, your forecast should typically be between 50 and 150.\n"+
			"Adjust for seasonality, demand patterns, trends, and anomalies for the target period.\n"+
			"Make meaningful, justified adjustments based on the data patterns you observe.\n"+
			"Baseline rows JSON:\n%s",
		period,
		forecastFor,
		window,
		string(inputJSON),
	)

	reqBody := chatRequest{
		Model:       model,
		Temperature: 0.2,
		Messages: []chatMessage{
			{Role: "user", Content: prompt},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	callCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	fmt.Println("[DEBUG] Calling GitHub Models API...")
	parsed, err := requestGitHubGenerateContent(callCtx, apiKey, bodyBytes)
	if err != nil {
		fmt.Printf("[DEBUG] API Error: %v\n", err)
		return nil, err
	}

	text := ""
	if len(parsed.Choices) > 0 {
		text = parsed.Choices[0].Message.Content
	}
	text = strings.TrimSpace(text)
	fmt.Printf("[DEBUG] Raw response text: %s\n", text)
	if text == "" {
		fmt.Println("[DEBUG] Empty response from API")
		return nil, nil
	}

	rowsJSON := extractJSONArray(text)
	fmt.Printf("[DEBUG] Extracted JSON: %s\n", rowsJSON)
	if rowsJSON == "" {
		fmt.Printf("[DEBUG] Failed to extract JSON from: %s\n", text)
		return nil, fmt.Errorf("claude returned non-json output")
	}

	var rows []forecastRow
	if err := json.Unmarshal([]byte(rowsJSON), &rows); err != nil {
		return nil, err
	}

	fmt.Printf("[DEBUG] Parsed %d forecast rows\n", len(rows))
	out := make(map[string]float64, len(rows))

	// Create a map of baseline values for validation
	baselineMap := make(map[string]float64)
	for _, row := range forecasts {
		key := forecastKey(row.ItemID, row.WarehouseID)
		baselineMap[key] = row.AverageNetChange
	}

	for _, row := range rows {
		forecast := row.AIForecastNet
		key := forecastKey(row.ItemID, row.WarehouseID)

		// Clamp forecast to ±75% of baseline (safety constraint to prevent wild outliers)
		if baseline, exists := baselineMap[key]; exists {
			maxDev := math.Abs(baseline) * 0.75
			if forecast > baseline+maxDev {
				fmt.Printf("[DEBUG] Clamping item_id=%d, warehouse_id=%d: %v -> %v (baseline=%v, max_dev=±%v)\n",
					row.ItemID, row.WarehouseID, forecast, baseline+maxDev, baseline, maxDev)
				forecast = baseline + maxDev
			} else if forecast < baseline-maxDev {
				fmt.Printf("[DEBUG] Clamping item_id=%d, warehouse_id=%d: %v -> %v (baseline=%v, max_dev=±%v)\n",
					row.ItemID, row.WarehouseID, forecast, baseline-maxDev, baseline, maxDev)
				forecast = baseline - maxDev
			}
		}

		fmt.Printf("[DEBUG] Forecast: item_id=%d, warehouse_id=%d, ai_forecast_net=%v\n", row.ItemID, row.WarehouseID, forecast)
		out[key] = forecast
	}
	return out, nil
}

func requestGitHubGenerateContent(ctx context.Context, apiKey string, bodyBytes []byte) (chatResponse, error) {
	var parsed chatResponse
	url := "https://models.inference.ai.azure.com/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return parsed, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	fmt.Printf("[DEBUG] Sending request to %s\n", url)
	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		fmt.Printf("[DEBUG] HTTP request error: %v\n", err)
		return parsed, err
	}
	defer resp.Body.Close()

	fmt.Printf("[DEBUG] Response status: %d\n", resp.StatusCode)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		fmt.Printf("[DEBUG] Error response body: %s\n", string(respBody))
		return parsed, fmt.Errorf("github models request failed: %s", strings.TrimSpace(string(respBody)))
	}

	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		fmt.Printf("[DEBUG] JSON decode error: %v\n", err)
		return parsed, err
	}

	fmt.Printf("[DEBUG] Successfully decoded response, choices count: %d\n", len(parsed.Choices))
	return parsed, nil
}

func extractJSONArray(s string) string {
	s = strings.TrimSpace(s)
	fmt.Printf("[DEBUG] extractJSONArray input (first 500 chars): %.500s\n", s)
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimPrefix(s, "json")
	s = strings.TrimSpace(strings.TrimSuffix(s, "```"))

	start := strings.Index(s, "[")
	end := strings.LastIndex(s, "]")
	fmt.Printf("[DEBUG] extractJSONArray: start=%d, end=%d\n", start, end)
	if start == -1 || end == -1 || end < start {
		return ""
	}
	result := s[start : end+1]
	fmt.Printf("[DEBUG] extractJSONArray result (first 500 chars): %.500s\n", result)
	return result
}
