package main

import "time"

type Item struct {
	ID   int    `json:"item_id"`
	SKU  string `json:"sku"`
	Name string `json:"name"`
}

type Inventory struct {
	ItemID          int       `json:"ItemID"`
	Name            string    `json:"Name"`
	CurrentQuantity int       `json:"CurrentQuantity"`
	LastUpdated     time.Time `json:"LastUpdated"`
	MinimumQuantity int       `json:"MinimumQuantity"`
	SKU             string    `json:"SKU"`
	WarehouseID     int       `json:"WarehouseID"`
	WarehouseCode   string    `json:"WarehouseCode"`
}

type Event struct {
	EventID        int       `json:"id"`
	ItemID         int       `json:"item_id"`
	UserID         int       `json:"user_id"`
	ItemName       string    `json:"item_name"`
	Username       string    `json:"username"`
	WarehouseID    int       `json:"warehouse_id"`
	WarehouseCode  string    `json:"warehouse_code"`
	EventType      string    `json:"type"`
	ReasonCode     string    `json:"reason_code"`
	QuantityChange int       `json:"quantity_change"`
	Timestamp      time.Time `json:"timestamp"`
}

type DailyStatement struct {
	Date        time.Time `json:"date"`
	ItemID      int       `json:"item_id"`
	ItemName    string    `json:"item_name"`
	InQuantity  int       `json:"in_quantity"`
	OutQuantity int       `json:"out_quantity"`
	NetChange   int       `json:"net_change"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type CreateEventRequest struct {
	ItemID         int    `json:"item_id"`
	WarehouseID    int    `json:"warehouse_id"`
	QuantityChange int    `json:"quantity_change"`
	EventType      string `json:"type"`
	ReasonCode     string `json:"reason_code"`
}

type session struct {
	Username  string
	ExpiresAt time.Time
}

type httpError struct {
	status int
	msg    string
}

type eventMutation struct {
	itemID      int
	warehouseID int
	delta       int
	eventType   string
	reason      string
}

type eventPlan struct {
	mutations []eventMutation
}
