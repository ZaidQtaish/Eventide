package main

import (
	"context"
	"errors"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var db *pgxpool.Pool

// InitDB initializes the database connection pool
func InitDB() error {
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
