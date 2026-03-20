# Eventide

Eventide is an event-sourced inventory management system with AI-powered stock forecasting.

## System Scope

In scope:
- Capture every inventory movement as immutable events (event sourcing)
- Build current stock state from event streams/snapshots
- Track inbound, outbound, transfers, and adjustments with full auditability
- Expose inventory, events, and daily movement summaries via API
- Provide AI forecasting for near-term stock demand and replenishment planning
- Present operational insights in a web dashboard

Out of scope:
- Full ERP workflows (procurement, accounting, invoicing)
- Advanced workforce/shift management
- Cross-organization multi-tenant controls
- Real-time IoT device ingestion pipelines

## Architecture

- Backend: Go
- Database: PostgreSQL
- Frontend: HTML/CSS/JS

## API Surface

- `GET /items`: list items
- `GET /inventory`: item snapshot + thresholds + SKU
- `GET /events`: recent inventory events
- `GET /daily-statements?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD[&item_id=N]`: aggregated daily movement

## Run Locally

1. Ensure PostgreSQL is running.
2. Create and seed the database using `Project Documentation/schema.sql`.
3. Verify the connection string in `database.go`.
4. Start the server:

```bash
go run .
```

App runs at `http://localhost:3000`.
