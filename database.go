package main

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

var db *pgxpool.Pool

const connStr = "postgres://postgres:admin123@127.0.0.1:5432/logistock"

// InitDB initializes the database connection pool
func InitDB() error {
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
