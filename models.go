package main

import "time"

type Item struct {
	ID   int    `json:"item_id"`
	SKU  string `json:"sku"`
	Name string `json:"name"`
}

type Inventory struct {
	ItemID          int       `json:"item_id"`
	Name            string    `json:"name"`
	CurrentQuantity int       `json:"current_quantity"`
	LastUpdated     time.Time `json:"last_updated"`
}
