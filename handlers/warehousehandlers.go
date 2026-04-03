package handlers

import (
"encoding/json"
"net/http"
"strings"
)

func (a *App) GetWarehousesHandler(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodGet {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

ctx := r.Context()

rows, err := a.DB.Query(ctx, "SELECT code, status FROM warehouses ORDER BY code")
if err != nil {
http.Error(w, "Query failed", http.StatusInternalServerError)
return
}
defer rows.Close()

var warehouses []Warehouse
for rows.Next() {
var wHouse Warehouse
if err := rows.Scan(&wHouse.Code, &wHouse.Status); err != nil {
continue
}
warehouses = append(warehouses, wHouse)
}

writeJSON(w, http.StatusOK, warehouses)
}

func (a *App) WarehousesHandler(w http.ResponseWriter, r *http.Request) {
if r.URL.Path != "/api/warehouses" {
code, err := parseWarehouseCodeFromPath(r.URL.Path)
if err != nil {
http.Error(w, "Invalid warehouse code", http.StatusBadRequest)
return
}

switch r.Method {
case http.MethodPut:
a.UpdateWarehouseStatusHandler(w, r, code)
default:
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}
return
}

switch r.Method {
case http.MethodGet:
a.GetWarehousesHandler(w, r)
default:
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}
}

func (a *App) UpdateWarehouseStatusHandler(w http.ResponseWriter, r *http.Request, code string) {
if a.GetSessionRole(r) != "admin" {
w.Header().Set("Content-Type", "application/json")
http.Error(w, "Only admins can update warehouse status", http.StatusForbidden)
return
}

var req struct {
Status string `json:"status"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid JSON", http.StatusBadRequest)
return
}

status := strings.ToLower(strings.TrimSpace(req.Status))
if status != "active" && status != "inactive" {
http.Error(w, "status must be active or inactive", http.StatusBadRequest)
return
}

ctx := r.Context()
var updated Warehouse
err := a.DB.QueryRow(
ctx,
"UPDATE warehouses SET status = $1 WHERE code = $2 RETURNING code, status",
status,
code,
).Scan(&updated.Code, &updated.Status)
if err != nil {
http.Error(w, "Failed to update warehouse", http.StatusInternalServerError)
return
}

writeJSON(w, http.StatusOK, updated)
}
