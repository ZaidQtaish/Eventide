package handlers

import "time"

type Item struct {
	ID           int     `json:"item_id"`
	SKU          string  `json:"sku"`
	Name         string  `json:"name"`
	Description  *string `json:"description,omitempty"`
	MinimumStock int     `json:"minimum_stock"`
	Category     *string `json:"category,omitempty"`
	SupplierID   *int    `json:"supplier_id,omitempty"`
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
	SKU            string    `json:"sku"`
	Username       string    `json:"username"`
	WarehouseID    int       `json:"warehouse_id"`
	WarehouseCode  string    `json:"warehouse_code"`
	EventType      string    `json:"type"`
	ReasonCode     string    `json:"reason_code"`
	QuantityChange int       `json:"quantity_change"`
	Timestamp      time.Time `json:"timestamp"`
}

type DailyStatement struct {
	Date          time.Time `json:"date"`
	ItemID        int       `json:"item_id"`
	ItemName      string    `json:"item_name"`
	WarehouseID   int       `json:"warehouse_id"`
	WarehouseCode string    `json:"warehouse_code"`
	InQuantity    int       `json:"in_quantity"`
	OutQuantity   int       `json:"out_quantity"`
	NetChange     int       `json:"net_change"`
}

type CreateEventRequest struct {
	ItemID         int    `json:"item_id"`
	WarehouseID    int    `json:"warehouse_id"`
	QuantityChange int    `json:"quantity_change"`
	EventType      string `json:"type"`
	ReasonCode     string `json:"reason_code"`
}

type CreateItemRequest struct {
	Name         string `json:"name"`
	SKU          string `json:"sku"`
	Description  string `json:"description"`
	Category     string `json:"category"`
	MinimumStock *int   `json:"minimum_stock"`
	SupplierID   *int   `json:"supplier_id"`
}

type CreateUserRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	PhoneNumber string `json:"phone_number"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type User struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	PhoneNumber string `json:"phone_number"`
}

type Warehouse struct {
	Code   string `json:"code"`
	Status string `json:"status"`
}

type MovingAverage struct {
	ItemID             int      `json:"item_id"`
	ItemName           string   `json:"item_name"`
	WarehouseID        int      `json:"warehouse_id"`
	Code               string   `json:"warehouse_code"`
	AverageInQuantity  float64  `json:"average_in_quantity"`
	AverageOutQuantity float64  `json:"average_out_quantity"`
	AverageNetChange   float64  `json:"average_net_change"`
	AIForecastNet      *float64 `json:"ai_forecast_net,omitempty"`
}

type ForecastResponse struct {
	ForecastFor string          `json:"forecast_for"`
	Period      string          `json:"period"`
	Window      int             `json:"window"`
	Forecasts   []MovingAverage `json:"forecasts"`
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

type monthlyAccumulator struct {
	in  int
	out int
}

type forecastRow struct {
	ItemID        int     `json:"item_id"`
	WarehouseID   int     `json:"warehouse_id"`
	AIForecastNet float64 `json:"ai_forecast_net"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float32       `json:"temperature,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}
