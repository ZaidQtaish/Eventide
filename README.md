# Eventide

Eventide is an event-driven inventory web app built with Go, PostgreSQL, and vanilla HTML/CSS/JS.

It focuses on operational visibility:
- current stock by warehouse
- immutable inventory event log
- daily in/out movement summaries
- warehouse-aware filtering across views

## Tech Stack

- Backend: Go (`net/http`)
- Database: PostgreSQL (`pgx` connection pool)
- Frontend: Static HTML/CSS/JS served by the Go app
- Auth: Cookie-based in-memory sessions

## Project Structure

```
.
|- main.go                 # Route wiring + static/app handlers
|- auth.go                 # Login/logout/session middleware
|- database.go             # DB connection init/close
|- handlers.go             # API handlers (items, inventory, events, etc.)
|- statements.go           # Daily statements query logic
|- models.go               # Shared data models
|- Project Documentation/
|  |- schema.sql           # DB schema + seed data
|- static/
|  |- index.html           # Public landing page
|  |- dashboard.html       # Protected app landing (/app/)
|  |- inventory/           # Current Stock page
|  |- events/              # Event Log page
|  |- warehouses/          # Warehouses page
|  |- daily-history/       # Daily History page
|  |- login/               # Login page
```

## How It Works

1. Inventory changes are recorded as immutable rows in `events`.
2. Snapshot quantities are maintained by DB logic (see `schema.sql`).
3. UI pages consume authenticated `/api/*` endpoints.
4. App pages are served under `/app/*` and require a valid session.

## Local Setup

### 1. Prerequisites

- Go 1.25+
- PostgreSQL

### 2. Create Database

Run the SQL in `Project Documentation/schema.sql` to create tables, triggers, and seed data.

### 3. Configure DB Connection

Edit the connection string in `database.go`:

```go
const connStr = "postgres://postgres:admin123@127.0.0.1:5432/eventide"
```

Update user/password/host/port/database as needed for your machine.

### 4. Install Dependencies

```bash
go mod tidy
```

### 5. Run

```bash
go run .
```

Server starts on:

`http://localhost:3000`

## Routing Overview

### Public Routes

- `GET /` - public landing page
- `GET /login/` - login UI
- `POST /api/login` - login endpoint
- `GET /logout` - clear session and redirect to `/`

### Protected App Routes (Browser)

- `/app/` - dashboard
- `/app/inventory/`
- `/app/events/`
- `/app/warehouses/`
- `/app/daily-history/`

### Protected API Routes

- `GET /api/items`
- `POST /api/items`
- `PUT /api/items/{id}`
- `GET /api/inventory`
- `GET /api/events`
- `POST /api/events`
- `GET /api/users`
- `GET /api/warehouses`
- `GET /api/daily-statements?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD[&item_id=N][&warehouse_code=CODE]`

## API Quick Examples

### Login

```bash
curl -i -X POST http://localhost:3000/api/login \
	-H "Content-Type: application/json" \
	-d '{"username":"admin","password":"admin123"}'
```

### List Inventory

```bash
curl -b "session_token=YOUR_TOKEN" http://localhost:3000/api/inventory
```

### Create Event

```bash
curl -X POST http://localhost:3000/api/events \
	-H "Content-Type: application/json" \
	-b "session_token=YOUR_TOKEN" \
	-d '{
		"item_id": 1,
		"warehouse_id": 1,
		"quantity_change": 10,
		"type": "inbound",
		"reason_code": "restock"
	}'
```

### Daily Statements (Warehouse-Aware)

```bash
curl -b "session_token=YOUR_TOKEN" \
	"http://localhost:3000/api/daily-statements?start_date=2026-03-01&end_date=2026-03-31&warehouse_code=WH-A"
```

## Auth Notes

- Session cookie name: `session_token`
- Session storage is in-memory (`auth.go`)
- Sessions expire after 12 hours
- Restarting the server clears active sessions

## Troubleshooting

### `go run .` fails

- Verify PostgreSQL is running.
- Verify `connStr` in `database.go` is correct.
- Ensure `eventide` database exists and schema has been applied.
- Run `go test ./...` to confirm compile health.

### `401 Unauthorized` on API calls

- You must be logged in first (`POST /api/login`).
- Ensure browser/curl is sending `session_token` cookie.

### Empty pages or missing filters

- Confirm `/api/warehouses`, `/api/items`, `/api/events`, `/api/inventory` return data.
- Check browser devtools network tab for failed requests.
