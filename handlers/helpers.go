package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func parseItemIDFromPath(path string) (int, error) {
	const prefix = "/api/items/"
	if !strings.HasPrefix(path, prefix) {
		return 0, strconv.ErrSyntax
	}
	itemIDPart := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if itemIDPart == "" || strings.Contains(itemIDPart, "/") {
		return 0, strconv.ErrSyntax
	}
	return strconv.Atoi(itemIDPart)
}

func parseUserIDFromPath(path string) (int, error) {
	const prefix = "/api/users/"
	if !strings.HasPrefix(path, prefix) {
		return 0, strconv.ErrSyntax
	}
	userIDPart := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if userIDPart == "" || strings.Contains(userIDPart, "/") {
		return 0, strconv.ErrSyntax
	}
	return strconv.Atoi(userIDPart)
}

func parseWarehouseCodeFromPath(path string) (string, error) {
	const prefix = "/api/warehouses/"
	if !strings.HasPrefix(path, prefix) {
		return "", strconv.ErrSyntax
	}
	codePart := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if codePart == "" || strings.Contains(codePart, "/") {
		return "", strconv.ErrSyntax
	}
	decoded, err := url.PathUnescape(codePart)
	if err != nil {
		return "", err
	}
	decoded = strings.TrimSpace(decoded)
	if decoded == "" {
		return "", strconv.ErrSyntax
	}
	return decoded, nil
}

func (e *httpError) Error() string { return e.msg }

func writeHTTPErr(w http.ResponseWriter, err error) {
	if he, ok := err.(*httpError); ok {
		http.Error(w, he.msg, he.status)
		return
	}
	http.Error(w, "Server error", http.StatusInternalServerError)
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}
