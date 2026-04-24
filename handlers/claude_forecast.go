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

func generateClaudeNetForecast(ctx context.Context, period, forecastFor string, window int, forecasts []MovingAverage) (map[string]aiForecastValues, error) {
	apiKey := strings.TrimSpace(os.Getenv("GITHUB_API_KEY"))
	if apiKey == "" || len(forecasts) == 0 {
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
		"You are assisting inventory forecasting. Return ONLY strict JSON array with objects: item_id (int), warehouse_id (int), ai_forecast_in (number), ai_forecast_out (number).\n"+
			"Do not include markdown, comments, or extra keys.\n"+
			"Context: period=%s, forecast_for=%s, window=%d.\n"+
			"For each row, forecast the inbound and outbound quantities separately.\n"+
			"- ai_forecast_in should be within ±50%% of average_in_quantity\n"+
			"- ai_forecast_out should be within ±50%% of average_out_quantity\n"+
			"Example: if average_in_quantity is 100, your forecast should typically be between 50 and 150.\n"+
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

	parsed, err := requestGitHubGenerateContent(callCtx, apiKey, bodyBytes)
	if err != nil {
		return nil, err
	}

	text := ""
	if len(parsed.Choices) > 0 {
		text = parsed.Choices[0].Message.Content
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, nil
	}

	rowsJSON := extractJSONArray(text)
	if rowsJSON == "" {
		return nil, fmt.Errorf("claude returned non-json output")
	}

	var rows []forecastRow
	if err := json.Unmarshal([]byte(rowsJSON), &rows); err != nil {
		return nil, err
	}

	out := make(map[string]aiForecastValues, len(rows))

	// Create maps of baseline values for validation
	baselineInMap := make(map[string]float64)
	baselineOutMap := make(map[string]float64)
	for _, row := range forecasts {
		key := forecastKey(row.ItemID, row.WarehouseID)
		baselineInMap[key] = row.AverageInQuantity
		baselineOutMap[key] = row.AverageOutQuantity
	}

	for _, row := range rows {
		forecastIn := row.AIForecastIn
		forecastOut := row.AIForecastOut
		key := forecastKey(row.ItemID, row.WarehouseID)

		// Clamp forecasts to ±75% of baseline (safety constraint to prevent wild outliers)
		if baselineIn, exists := baselineInMap[key]; exists {
			maxDevIn := math.Abs(baselineIn) * 0.75
			if forecastIn > baselineIn+maxDevIn {
				forecastIn = baselineIn + maxDevIn
			} else if forecastIn < baselineIn-maxDevIn {
				forecastIn = baselineIn - maxDevIn
			}
		}

		if baselineOut, exists := baselineOutMap[key]; exists {
			maxDevOut := math.Abs(baselineOut) * 0.75
			if forecastOut > baselineOut+maxDevOut {
				forecastOut = baselineOut + maxDevOut
			} else if forecastOut < baselineOut-maxDevOut {
				forecastOut = baselineOut - maxDevOut
			}
		}

		out[key] = aiForecastValues{In: forecastIn, Out: forecastOut}
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

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return parsed, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return parsed, fmt.Errorf("github models request failed: %s", strings.TrimSpace(string(respBody)))
	}

	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return parsed, err
	}

	return parsed, nil
}

func extractJSONArray(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimPrefix(s, "json")
	s = strings.TrimSpace(strings.TrimSuffix(s, "```"))

	start := strings.Index(s, "[")
	end := strings.LastIndex(s, "]")
	if start == -1 || end == -1 || end < start {
		return ""
	}
	return s[start : end+1]
}
