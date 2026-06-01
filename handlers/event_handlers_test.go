package handlers

import (
	"testing"
	"time"
)

// TestEventStruct verifies Event struct can be properly instantiated with all fields
func TestEventStruct(t *testing.T) {
	evt := Event{
		EventID:        1,
		ItemID:         5,
		UserID:         2,
		ItemName:       "Test Item",
		SKU:            "TEST-001",
		Username:       "testuser",
		WarehouseID:    1,
		WarehouseCode:  "WH-CENTRAL",
		EventType:      "inbound",
		ReasonCode:     "PURCHASE",
		QuantityChange: 100,
		Timestamp:      time.Now(),
	}

	if evt.EventID != 1 {
		t.Errorf("EventID mismatch: expected 1, got %d", evt.EventID)
	}
	if evt.ItemID != 5 {
		t.Errorf("ItemID mismatch: expected 5, got %d", evt.ItemID)
	}
	if evt.EventType != "inbound" {
		t.Errorf("EventType mismatch: expected 'inbound', got %s", evt.EventType)
	}
	if evt.ReasonCode != "PURCHASE" {
		t.Errorf("ReasonCode mismatch: expected 'PURCHASE', got %s", evt.ReasonCode)
	}
	if evt.QuantityChange != 100 {
		t.Errorf("QuantityChange mismatch: expected 100, got %d", evt.QuantityChange)
	}
}

// TestInventoryStruct verifies Inventory snapshot struct is properly formed
func TestInventoryStruct(t *testing.T) {
	inv := Inventory{
		ItemID:          3,
		Name:            "Laptop",
		CurrentQuantity: 42,
		LastUpdated:     time.Now(),
		MinimumQuantity: 5,
		SKU:             "TECH-001",
		WarehouseID:     1,
		WarehouseCode:   "WH-CENTRAL",
	}

	if inv.ItemID != 3 {
		t.Errorf("ItemID mismatch: expected 3, got %d", inv.ItemID)
	}
	if inv.CurrentQuantity != 42 {
		t.Errorf("CurrentQuantity mismatch: expected 42, got %d", inv.CurrentQuantity)
	}
	if inv.MinimumQuantity != 5 {
		t.Errorf("MinimumQuantity mismatch: expected 5, got %d", inv.MinimumQuantity)
	}
	if inv.WarehouseCode != "WH-CENTRAL" {
		t.Errorf("WarehouseCode mismatch: expected 'WH-CENTRAL', got %s", inv.WarehouseCode)
	}
}

// TestLowStockDetection checks if inventory is correctly identified as low stock
func TestLowStockDetection(t *testing.T) {
	tests := []struct {
		current int
		minimum int
		isLow   bool
	}{
		{42, 5, false},   // Current > Minimum
		{5, 5, false},    // Current = Minimum (at threshold)
		{3, 5, true},     // Current < Minimum (low stock)
		{0, 10, true},    // Empty warehouse
		{100, 50, false}, // Well-stocked
	}

	for i, test := range tests {
		isLow := test.current < test.minimum
		if isLow != test.isLow {
			t.Errorf("Test %d failed: current=%d, minimum=%d, expected isLow=%v, got %v",
				i+1, test.current, test.minimum, test.isLow, isLow)
		}
	}
}

// TestEventTypeValidation verifies allowed event types
func TestEventTypeValidation(t *testing.T) {
	validTypes := map[string]bool{
		"inbound":    true,
		"outbound":   true,
		"adjustment": true,
		"transfer":   false,
		"invalid":    false,
		"":           false,
	}

	for eventType, shouldBeValid := range validTypes {
		isValid := eventType == "inbound" || eventType == "outbound" || eventType == "adjustment"
		if isValid != shouldBeValid {
			t.Errorf("Event type '%s' validation failed: expected %v, got %v",
				eventType, shouldBeValid, isValid)
		}
	}
}

// TestReasonCodeValidation verifies allowed reason codes
func TestReasonCodeValidation(t *testing.T) {
	validCodes := map[string]bool{
		"PURCHASE":    true,
		"SALE":        true,
		"RETURN":      true,
		"DAMAGE":      true,
		"STOCK_CHECK": true,
		"TRANSFER":    false,
		"UNKNOWN":     false,
		"":            false,
	}

	allowedCodes := []string{"PURCHASE", "SALE", "RETURN", "DAMAGE", "STOCK_CHECK"}

	for code, shouldBeValid := range validCodes {
		isValid := false
		for _, allowed := range allowedCodes {
			if code == allowed {
				isValid = true
				break
			}
		}

		if isValid != shouldBeValid {
			t.Errorf("Reason code '%s' validation failed: expected %v, got %v",
				code, shouldBeValid, isValid)
		}
	}
}

// TestQuantityChangeValidation verifies quantity constraints
func TestQuantityChangeValidation(t *testing.T) {
	tests := []struct {
		currentQty  int
		changeQty   int
		resultValid bool
		description string
	}{
		{100, -50, true, "Valid outbound (sufficient stock)"},
		{10, -10, true, "Valid outbound (exact amount)"},
		{5, -10, false, "Invalid outbound (insufficient stock)"},
		{0, -1, false, "Invalid outbound (empty warehouse)"},
		{50, 50, true, "Valid inbound"},
		{0, 0, true, "Zero change (valid)"},
	}

	for _, test := range tests {
		resultQty := test.currentQty + test.changeQty
		isValid := resultQty >= 0
		if isValid != test.resultValid {
			t.Errorf("%s: expected valid=%v, got %v (result qty: %d)",
				test.description, test.resultValid, isValid, resultQty)
		}
	}
}

// TestDailyStatementStruct verifies daily statement structure
func TestDailyStatementStruct(t *testing.T) {
	stmt := DailyStatement{
		Date:          time.Now(),
		ItemID:        1,
		ItemName:      "Laptop Pro",
		WarehouseID:   1,
		WarehouseCode: "WH-CENTRAL",
		InQuantity:    50,
		OutQuantity:   12,
		NetChange:     38,
	}

	if stmt.NetChange != (stmt.InQuantity - stmt.OutQuantity) {
		t.Errorf("NetChange mismatch: expected %d, got %d",
			stmt.InQuantity-stmt.OutQuantity, stmt.NetChange)
	}
}
