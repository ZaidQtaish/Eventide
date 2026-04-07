package main

import (
	"context"
	"errors"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var db *pgxpool.Pool

// InitDB initializes the database connection pool
func InitDB() error {
	// Load local env file for development; keep existing environment variables intact.
	_ = godotenv.Load()

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		return errors.New("DATABASE_URL is not set")
	}

	var err error
	db, err = pgxpool.New(context.Background(), connStr)
	if err != nil {
		return err
	}
	// Test the connection
	err = db.Ping(context.Background())
	if err != nil {
		return err
	}
	return nil
}

// CloseDB closes the database connection pool
func CloseDB() {
	if db != nil {
		db.Close()
	}
}
