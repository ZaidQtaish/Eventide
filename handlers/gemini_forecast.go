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
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" || len(forecasts) == 0 {
		return nil, nil
	}

	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = "gemini-2.5-flash"
	}
	model = strings.TrimPrefix(model, "models/")

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
			"Also account for seasonality for the target period (month/day effects, recurring seasonal demand), while keeping adjustments conservative unless baseline strongly suggests otherwise.\n"+
			"If seasonality signal is weak, stay close to baseline average_net_change.\n"+
			"Baseline rows JSON:\n%s",
		period,
		forecastFor,
		window,
		string(inputJSON),
	)

	var reqBody geminiRequest
	reqBody.Contents = append(reqBody.Contents, struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	}{
		Parts: []struct {
			Text string `json:"text"`
		}{{Text: prompt}},
	})
	reqBody.GenerationConfig = map[string]any{"temperature": 0.2}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	callCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	parsed, err := requestGeminiGenerateContent(callCtx, apiKey, model, bodyBytes)
	if err != nil {
		// Fallback to a known-good model for this API version when configured model is unsupported.
		if !strings.Contains(model, "2.5-flash") {
			parsed, err = requestGeminiGenerateContent(callCtx, apiKey, "gemini-2.5-flash", bodyBytes)
		}
		if err != nil {
			return nil, err
		}
	}

	text := ""
	if len(parsed.Candidates) > 0 {
		for _, part := range parsed.Candidates[0].Content.Parts {
			text += part.Text
		}
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, nil
	}

	rowsJSON := extractJSONArray(text)
	if rowsJSON == "" {
		return nil, fmt.Errorf("gemini returned non-json output")
	}

	var rows []geminiRow
	if err := json.Unmarshal([]byte(rowsJSON), &rows); err != nil {
		return nil, err
	}

	out := make(map[string]float64, len(rows))
	for _, row := range rows {
		out[forecastKey(row.ItemID, row.WarehouseID)] = row.AIForecastNet
	}
	return out, nil
}

func requestGeminiGenerateContent(ctx context.Context, apiKey, model string, bodyBytes []byte) (geminiResponse, error) {
	var parsed geminiResponse
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return parsed, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return parsed, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return parsed, fmt.Errorf("gemini request failed: %s", strings.TrimSpace(string(respBody)))
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
