package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func forecastKey(itemID, warehouseID int) string {
	return fmt.Sprintf("%d|%d", itemID, warehouseID)
}

func generateGeminiNetForecast(ctx context.Context, period, forecastFor string, window int, forecasts []MovingAverage) (map[string]float64, error) {
	apiKey := strings.TrimSpace(os.Getenv("GITHUB_API_KEY"))
	if apiKey == "" || len(forecasts) == 0 {
		return nil, nil
	}

	model := strings.TrimSpace(os.Getenv("GITHUB_MODEL"))
	if model == "" {
		model = "claude-haiku-4.5"
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
			"Use the moving-average baseline rows below to estimate ai_forecast_net for each row.\n"+
			"Consider seasonality, demand patterns, trends, and anomalies for the target period.\n"+
			"Make meaningful adjustments (±10-30%% from baseline) when patterns suggest it.\n"+
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
		return nil, fmt.Errorf("gemini returned non-json output")
	}

	var rows []forecastRow
	if err := json.Unmarshal([]byte(rowsJSON), &rows); err != nil {
		return nil, err
	}

	out := make(map[string]float64, len(rows))
	for _, row := range rows {
		out[forecastKey(row.ItemID, row.WarehouseID)] = row.AIForecastNet
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
