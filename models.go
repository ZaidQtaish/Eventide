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
}

type Event struct {
	EventID        int       `json:"event_id"`
	ItemID         int       `json:"item_id"`
	UserID         int       `json:"user_id"`
	ItemName       string    `json:"item_name"`
	Username       string    `json:"username"`
	EventType      string    `json:"event_type"`
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
