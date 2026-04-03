package handlers

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// App holds shared dependencies for all HTTP handlers.
type App struct {
	DB             *pgxpool.Pool
	GetSessionUser func(*http.Request) string
	GetSessionRole func(*http.Request) string
}

// NewApp creates a new App instance with injected dependencies.
func NewApp(db *pgxpool.Pool, getSessionUser func(*http.Request) string, getSessionRole func(*http.Request) string) *App {
	return &App{
		DB:             db,
		GetSessionUser: getSessionUser,
		GetSessionRole: getSessionRole,
	}
}
