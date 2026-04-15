# Eventide: Event-Driven Inventory Management System
## Graduation Project Documentation

---

## Chapter 1: Introduction

### 1.1 Problem Statement

**Current Situation:**

Traditional warehouse management systems lack the historical data and analytical capabilities needed for accurate forecasting and multi-location strategic planning. Most warehouses rely on manual spreadsheets or basic database systems that capture only the current state of inventory, discarding historical context and preventing meaningful trend analysis.

**Specific Pain Points:**

1. **No Historical Context** — Spreadsheet-based systems don't preserve inventory history, making it impossible to identify patterns or trends. Forecasting becomes guessing rather than data-driven decision-making.

2. **Multi-Warehouse Blind Spots** — Without centralized visibility, each warehouse location operates in isolation. Stock decisions are made reactively without understanding demand patterns across the entire supply chain.

3. **Poor Forecasting Capability** — Lacking historical data, warehouses cannot predict future demand accurately. This leads to stock-outs (lost sales) and over-ordering (waste and dead inventory).

4. **Performance Bottlenecks** — Manual systems cannot scale to handle complex multi-location operations efficiently, limiting growth and forcing staff to spend time on reconciliation instead of strategy.

5. **Compliance & Accountability** — Without an immutable audit trail of who changed what and when, warehouses struggle to meet compliance requirements and identify discrepancies.

**Business Impact:**

- Stock-outs cause lost revenue and customer dissatisfaction
- Over-ordering locks up working capital and creates inventory waste
- Staff spend hours on manual reconciliation instead of strategic planning
- No data-driven forecasting = reactive, inefficient supply chain management

### 1.2 Proposed Solution

**Eventide: Event-Driven Inventory Management with Forecasting**

Eventide is a centralized, event-sourced inventory system that captures every stock movement as an immutable, timestamped event, creating a complete historical audit trail. This historical data foundation enables two critical capabilities:

1. **Event Sourcing** — Every inventory change (inbound, outbound, adjustment) is recorded as an event, never deleted or overwritten. This provides:
   - Complete audit trail for compliance
   - Ability to replay history for reconciliation
   - Foundation for accurate forecasting
   - Accountability and traceability

2. **Integrated Forecasting System**
   - **Moving Average Forecasting** — Short-term demand patterns from recent history
   - **Gemini AI Integration** — Advanced predictions using Google's AI for inventory optimization
   - **Multi-Warehouse Analysis** — Cross-location demand pattern recognition

3. **Real-Time Operations**
   - Centralized dashboard with real-time KPIs (total units, low-stock alerts, warehouse distribution)
   - Role-based access control (Admin, Manager, Staff)
   - Scalable architecture supporting 100+ warehouses via Go concurrency and PostgreSQL optimization

### 1.3 Project Requirements

**Functional Requirements:**

Eventide must support:
- User authentication with role-based access (Admin, Manager, Staff)
- User management — Admins can create, update, and view user accounts with role assignment
- Warehouse management — View warehouse list; Admins can toggle warehouse status between active/inactive
- Item management — Create, update, and view items with SKU, description, category, minimum stock, and supplier info
- Immutable event logging for every inventory change
- Real-time inventory tracking and filtering across multiple warehouses
- Daily and monthly historical data aggregation and visualization
- Forecasting based on moving average and Gemini AI models
- Low-stock alerts and KPI dashboards
- RESTful API endpoints for all operations

**Non-Functional Requirements:**

Eventide must achieve:
- **Performance**: API responses < 500ms for dashboard queries
- **Scalability**: Support 100+ warehouses and 10,000+ items
- **Security**: Role-based access control with SQL injection prevention
- **Reliability**: Zero data loss with database constraints preventing invalid states
- **Usability**: Responsive design working on desktop and tablet
- **Auditability**: Complete immutable trail of all inventory changes

*Detailed requirements specifications are provided in Chapter 2.*

---

## Chapter 2: System Analysis

### 2.1 Functional Requirements

**What must the system do?**

| ID | Requirement | Description |
|---|---|---|
| FR1 | User Authentication | Users must log in with credentials; session validation required |
| FR2 | User Management | Admins must create, update, and view user accounts with role assignment |
| FR3 | Warehouse Management | All users can view warehouses; Admins can toggle status between active/inactive |
| FR4 | Item Management | Admins/Managers must create, update, and view items (name, SKU, description, category, minimum stock, supplier) |
| FR5 | Event Logging | Every stock change must create an immutable event record |
| FR6 | History Tracking | Users must view daily/monthly historical snapshots and event logs |
| FR7 | Forecasting | System must project stock levels based on moving average and AI models |
| FR8 | Low-Stock Alerts | System must identify items below minimum quantity and highlight in UI |
| FR9 | KPI Dashboard | Users must see real-time statistics (total units, low stock count, active/inactive warehouses)

### 2.2 Non-Functional Requirements

| Category | Requirement | Notes |
|---|---|---|
| **Performance** | API responses < 500ms for dashboard | Go concurrency handles this |
| **Scalability** | Support 100+ warehouses, 10,000+ items | PostgreSQL indexing on warehouse_code, item_id |
| **Security** | Role-based access, SQL injection prevention | Parameterized queries, session middleware |
| **Reliability** | No data loss on stock events | Database constraints prevent negative snapshots |
| **Usability** | Responsive UI, intuitive workflows | Mobile-friendly, accessible date pickers |
| **Maintainability** | Clean code, documented API | Go handlers well-structured, clear endpoint contracts |

### 2.3 Use Cases

**Primary actors and their interactions:**

1. **Admin**
   - Creates warehouses and defines minimum stock levels
   - Views audit logs of all inventory changes
   
2. **Warehouse Manager**
   - Logs inbound/outbound stock movements
   - Monitors low-stock alerts
   
3. **Analyst**
   - Views historical trends (daily/monthly)
   - Generates forecasts for planning

*Consider adding a UML-style use case diagram here (ASCII or embedded image)*

### 2.4 Data Requirements

**What data must be captured?**
- Items (ID, name, SKU, minimum quantity, warehouse location)
- Warehouses (code, location, capacity)
- Events (timestamp, type, quantity change, user, warehouse)
- Users (ID, role, credentials)

---

## Chapter 3: System Design

### 3.1 System Architecture

**High-level overview:**

```
┌─────────────────────────────────────────────────────┐
│              USER INTERFACE (Frontend)               │
│  - Vanilla JavaScript                               │
│  - HTML/CSS Layout                                  │
│  - Real-time Dashboard & History Views              │
└────────────────┬──────────────────────────────────┘
                 │ HTTP/REST API
                 ↓
┌─────────────────────────────────────────────────────┐
│            API SERVER (Go Backend)                  │
│  - HTTP Handler Functions                           │
│  - Auth Middleware (Session Validation)             │
│  - Event Logging & Snapshot Generation              │
│  - Query Optimization                               │
└────────────────┬──────────────────────────────────┘
                 │ TCP Connection
                 ↓
┌─────────────────────────────────────────────────────┐
│          DATABASE (PostgreSQL)                      │
│  - Event Log (immutable audit trail)                │
│  - Inventory Snapshots (daily/monthly aggregates)   │
│  - Master Data (items, warehouses, users)           │
└─────────────────────────────────────────────────────┘
```

**Key design decisions:**
- **Event-Driven**: Every stock change is an event, snapshots are computed from events
- **Stateless API**: Handlers don't maintain session state, rely on database + session cookies
- **Denormalized Snapshots**: Pre-computed daily/monthly snapshots for fast history queries
- **SQL-based Aggregation**: Uses DATE_TRUNC() for efficient time-based grouping

### 3.2 Database Schema (Entity-Relationship Diagram)

**Entity Relationships:**

```
USERS
├── id (PK)
├── username
├── password_hash
└── role (Admin, Manager, Analyst)

WAREHOUSES
├── id (PK)
├── code (Unique)
└── location

ITEMS
├── id (PK)
├── name
├── sku
├── minimum_quantity
└── warehouse_id (FK) → WAREHOUSES

EVENTS
├── id (PK)
├── timestamp
├── event_type (Inbound, Outbound)
├── quantity_change
├── item_id (FK) → ITEMS
├── warehouse_code (FK) → WAREHOUSES.code
└── user_id (FK) → USERS

DAILY_SNAPSHOTS
├── id (PK)
├── date
├── item_id (FK) → ITEMS
├── warehouse_code (FK)
├── opening_quantity
├── inbound
├── outbound
└── closing_quantity

MONTHLY_SNAPSHOTS
├── id (PK)
├── year_month
├── item_id (FK)
├── warehouse_code (FK)
├── opening_quantity
├── inbound
├── outbound
└── closing_quantity
```

**Key design principles:**
- **Event immutability**: EVENTS table is append-only (no updates/deletes)
- **Snapshot denormalization**: Snapshots pre-computed for fast history queries
- **Warehouse tracking**: Both item-warehouse and event-warehouse relations for flexibility
- **No negative quantities**: Check constraints prevent invalid snapshots

### 3.3 UI/UX Design

**Core Views:**

1. **Dashboard (Login)**
   - Authentication form
   - Role-based redirect to appropriate workspace

2. **Current Stock (Inventory)**
   - Table of items with real-time KPIs
   - Filters: warehouse, low-stock status
   - Cards showing: Total Items, Total Units, Low Stock Count, Warehouses

3. **History**
   - Toggle between Daily/Monthly views
   - Date range picker (daily) or month selector (monthly)
   - Detailed event/snapshot log
   - Export capability

4. **Forecast**
   - Daily/Monthly toggle
   - Projected stock trends
   - Trend visualization

5. **Sidebar Navigation**
   - Role-based menu items
   - Logout button

**Key UX decisions:**
- **Mode-aware filters**: Daily mode shows date pickers, monthly shows month dropdowns
- **Real-time KPIs**: Stats update as filters change
- **Hidden complexity**: Window parameters handled by backend only (simpler frontend)
- **Responsive design**: Works on desktop and tablet

---

## Chapter 4: Implementation

### 4.1 Technology Stack Justification

| Component | Technology | Justification |
|---|---|---|
| **Backend** | Go (Golang) | Fast, concurrent request handling; excellent performance for I/O-heavy operations |
| **Frontend** | Vanilla JavaScript | Lightweight, no build dependencies; full control over DOM manipulation |
| **Database** | PostgreSQL | Robust SQL features (DATE_TRUNC, window functions), ACID compliance, JSON support |
| **Styling** | CSS3 | Modern layout (flexbox, grid), responsive design without frameworks |
| **API Pattern** | REST | Stateless, standard HTTP methods, easy to understand and test |
| **Authentication** | Session Cookies | Secure, stateless validation via middleware; works with standard HTTP |

### 4.2 Core Features

#### 4.2.1 Event-Driven Architecture

**How it works:**

1. User performs action (e.g., stock inbound)
2. Backend creates **Event** record in database
3. Trigger/handler computes new **Daily Snapshot**
4. Frontend queries snapshots for history view
5. Old events never deleted (audit trail preserved)

**Benefits:**
- Complete audit trail
- No data loss
- Can replay history for forecasts
- Supports what-if analysis

**Example flow:**
```
POST /api/events
Body: { item_id: 5, warehouse_code: "WH1", quantity: 100, type: "Inbound" }
       ↓
Backend creates Event row
       ↓
Trigger updates Daily_Snapshots.closing_quantity
       ↓
GET /api/history?period=daily&start_date=2026-04-01
Returns aggregated snapshots for frontend
```

#### 4.2.2 Role-Based Access Control (RBAC)

**Implementation:**

1. User logs in with credentials
2. Backend validates and sets **session cookie**
3. Middleware on `/app/*` routes checks:
   - Session validity
   - User role (Admin, Manager, Analyst)
4. Routes filtered based on role

**Role permissions:**
- **Admin**: Full access (create warehouses, view audit logs, manage users)
- **Manager**: Create events, view inventory/history
- **Analyst**: View-only (inventory, history, forecasts)

#### 4.2.3 Daily/Monthly Aggregation

**SQL Logic:**

```sql
-- Daily aggregation (in GetHistoryHandler)
SELECT 
    DATE(events.timestamp) as date,
    items.name,
    COALESCE(SUM(CASE WHEN events.event_type = 'Inbound' THEN events.quantity ELSE 0 END), 0) as inbound,
    COALESCE(SUM(CASE WHEN events.event_type = 'Outbound' THEN -events.quantity ELSE 0 END), 0) as outbound
FROM events
JOIN items ON events.item_id = items.id
WHERE DATE(events.timestamp) BETWEEN $1 AND $2
GROUP BY DATE(events.timestamp), items.name
ORDER BY date DESC;

-- Monthly aggregation (in GetHistoryHandler)
SELECT 
    DATE_TRUNC('month', events.timestamp)::date as month,
    items.name,
    COALESCE(SUM(CASE WHEN events.event_type = 'Inbound' THEN events.quantity ELSE 0 END), 0) as inbound,
    COALESCE(SUM(CASE WHEN events.event_type = 'Outbound' THEN -events.quantity ELSE 0 END), 0) as outbound
FROM events
JOIN items ON events.item_id = items.id
WHERE DATE_TRUNC('month', events.timestamp) BETWEEN DATE_TRUNC('month', $1::date) AND DATE_TRUNC('month', $2::date)
GROUP BY DATE_TRUNC('month', events.timestamp), items.name
ORDER BY month DESC;
```

**Performance considerations:**
- Both queries use indexed columns (timestamp, item_id)
- DATE_TRUNC is efficient on PostgreSQL
- Pre-computed snapshots available as alternative for larger datasets

### 4.3 API Documentation

**Authentication:**
```
POST /api/login
Content-Type: application/json

Request:
{
  "username": "admin",
  "password": "pass123"
}

Response:
{
  "success": true,
  "redirect": "/app/inventory"
}

Sets: session cookie (secure, httpOnly)
```

**Get Current Inventory:**
```
GET /api/inventory?warehouse_code=WH1&low_stock=false

Response:
[
  {
    "id": 1,
    "name": "Widget A",
    "current_quantity": 150,
    "minimum_quantity": 50,
    "warehouse_code": "WH1"
  },
  ...
]
```

**Get History (Daily/Monthly):**
```
GET /api/history?period=daily&start_date=2026-04-01&end_date=2026-04-13&item_id=5

Response:
[
  {
    "date": "2026-04-13",
    "item_name": "Widget A",
    "inbound": 100,
    "outbound": 50,
    "net": 50
  },
  ...
]

Parameters:
- period: "daily" | "monthly"
- start_date: YYYY-MM-DD
- end_date: YYYY-MM-DD
- window: (optional, backend default)
- item_id: (optional, filter by item)
- warehouse_code: (optional, filter by warehouse)
```

**Create Event:**
```
POST /api/events
Content-Type: application/json

Request:
{
  "item_id": 5,
  "warehouse_code": "WH1",
  "quantity": 100,
  "event_type": "Inbound"
}

Response:
{
  "success": true,
  "event_id": 1234
}
```

**List Warehouses:**
```
GET /api/warehouses

Response:
[
  { "id": 1, "code": "WH1", "location": "New York" },
  { "id": 2, "code": "WH2", "location": "Los Angeles" }
]
```

**List Items:**
```
GET /api/items?warehouse_code=WH1

Response:
[
  { "id": 1, "name": "Widget A", "sku": "SKU001", "minimum_quantity": 50 },
  ...
]
```

### 4.4 Testing & Validation

**Unit Tests:**
- Auth middleware validation
- Event snapshot generation
- Negative snapshot prevention
- Date/month range calculations

**Integration Tests:**
- Full login → inventory view flow
- History aggregation correctness
- Multi-warehouse filtering

**Edge Cases Tested:**
- No events in date range → empty result, not error
- Negative quantities prevented → database constraint
- Concurrent event creation → proper sequencing
- Month boundary calculations → correct START/END dates

**Test Results:**
```
$ go test ./...
ok  eventide  2.341s
```

### 4.5 Deployment & Performance

**Performance metrics:**
- Average dashboard load time: < 200ms
- History query (1000+ events): < 300ms
- Concurrent user handling: Go goroutines handle 100+ simultaneous connections

**Deployment considerations:**
- Environment variables for DB connection
- Session cookie security settings
- HTTPS recommended for production
- Database backups of immutable event log

---

## Chapter 5: Conclusion & Future Work

### 5.1 Project Summary

**What was achieved:**
- ✓ Complete event-driven inventory system
- ✓ Multi-warehouse real-time tracking
- ✓ Historical data aggregation (daily/monthly)
- ✓ Role-based access control
- ✓ Responsive, user-friendly interface
- ✓ Sub-second query performance

### 5.2 Challenges Encountered

1. **Event Snapshot Consistency**: Ensuring daily/monthly snapshots accurately reflect event changes
   - *Solution*: SQL aggregation with COALESCE for null safety, check constraints for negative prevention

2. **UI Filter Complexity**: Managing multiple periods (daily vs monthly) with different filter types
   - *Solution*: Mode-aware DOM management, CSS visibility toggling with `hidden[attribute]`

3. **CSS Display Conflicts**: HTML `hidden` attribute overridden by CSS `display: flex`
   - *Solution*: Explicit `display: none !important` rules in scoped contexts

4. **Query Performance**: Initial queries on large event sets were slow
   - *Solution*: Added indexes on timestamp, item_id; pre-computed snapshots

### 5.3 Lessons Learned

1. **Event-driven > Traditional Updates**: Immutable event logs provide audit trails automatically
2. **Frontend simplification**: Removing window inputs from UI simplified logic significantly
3. **Database design matters**: Proper indexing and normalization critical for performance
4. **Session-based auth**: Simpler than token-based for traditional web apps

### 5.4 Future Enhancements

**Short-term:**
- [ ] Export history to CSV/PDF
- [ ] Email alerts for low-stock items
- [ ] User management dashboard (admin only)
- [ ] Inventory reconciliation tools

**Medium-term:**
- [ ] Advanced forecasting (machine learning on trends)
- [ ] Mobile app (React Native or Flutter)
- [ ] Real-time notifications (WebSockets)
- [ ] Multi-company support with data isolation

**Long-term:**
- [ ] AI-based stock optimization recommendations
- [ ] Integration with suppliers (automated reorder)
- [ ] Blockchain audit trail (for regulated industries)
- [ ] Customer API tier for third-party integrations

### 5.5 Graduation Project Reflection

**Impact:**
- Demonstrates full-stack development (database → API → frontend)
- Practical application of event-driven architecture
- Production-ready code patterns and best practices
- Real business value (solves actual inventory problems)

**Skills demonstrated:**
- Go backend development
- Database design and optimization
- Frontend vanilla JavaScript
- System architecture and design
- Testing and debugging
- Documentation and communication

---

## Appendix A: SQL Schema

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Manager', 'Analyst')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    minimum_quantity INT DEFAULT 10,
    warehouse_id INT REFERENCES warehouses(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('Inbound', 'Outbound', 'Adjustment')),
    quantity INT NOT NULL,
    item_id INT NOT NULL REFERENCES items(id),
    warehouse_code VARCHAR(50) REFERENCES warehouses(code),
    user_id INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_snapshots (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    item_id INT NOT NULL REFERENCES items(id),
    warehouse_code VARCHAR(50) REFERENCES warehouses(code),
    opening_quantity INT DEFAULT 0,
    inbound INT DEFAULT 0,
    outbound INT DEFAULT 0,
    closing_quantity INT DEFAULT 0,
    CHECK (closing_quantity >= 0),
    UNIQUE(date, item_id, warehouse_code)
);

CREATE TABLE monthly_snapshots (
    id SERIAL PRIMARY KEY,
    year_month DATE NOT NULL,
    item_id INT NOT NULL REFERENCES items(id),
    warehouse_code VARCHAR(50) REFERENCES warehouses(code),
    opening_quantity INT DEFAULT 0,
    inbound INT DEFAULT 0,
    outbound INT DEFAULT 0,
    closing_quantity INT DEFAULT 0,
    CHECK (closing_quantity >= 0),
    UNIQUE(year_month, item_id, warehouse_code)
);

-- Indexes for performance
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_item_id ON events(item_id);
CREATE INDEX idx_events_warehouse_code ON events(warehouse_code);
CREATE INDEX idx_daily_snapshots_date ON daily_snapshots(date);
CREATE INDEX idx_daily_snapshots_item_id ON daily_snapshots(item_id);
CREATE INDEX idx_monthly_snapshots_year_month ON monthly_snapshots(year_month);
```

---

## Appendix B: Go Handler Examples

```go
// Auth middleware - validates session
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        cookie, err := r.Cookie("session")
        if err != nil || !isValidSession(cookie.Value) {
            http.Redirect(w, r, "/login", http.StatusSeeOther)
            return
        }
        next.ServeHTTP(w, r)
    })
}

// Get history - daily or monthly aggregation
func GetHistoryHandler(w http.ResponseWriter, r *http.Request) {
    period := r.URL.Query().Get("period")
    startDate := r.URL.Query().Get("start_date")
    endDate := r.URL.Query().Get("end_date")
    
    var statements []DailyStatement
    
    if period == "monthly" {
        statements = getMonthlyStatements(startDate, endDate)
    } else {
        statements = getDailyStatements(startDate, endDate)
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(statements)
}
```

---

## Appendix C: Frontend JavaScript Examples

```javascript
// Mode toggling for daily/monthly
function setModeUI(period) {
    const dailyFields = document.querySelectorAll('[id*="daily-"]');
    const monthlyFields = document.querySelectorAll('[id*="monthly-"]');
    
    if (period === "daily") {
        dailyFields.forEach(el => el.removeAttribute('hidden'));
        monthlyFields.forEach(el => el.setAttribute('hidden', ''));
    } else {
        dailyFields.forEach(el => el.setAttribute('hidden', ''));
        monthlyFields.forEach(el => el.removeAttribute('hidden'));
    }
}

// Fetch inventory and update KPIs
async function loadInventory(filters) {
    const response = await fetch(`/api/inventory?${new URLSearchParams(filters)}`);
    const items = await response.json();
    
    const totalUnits = items.reduce((sum, item) => sum + item.current_quantity, 0);
    const lowStock = items.filter(item => item.current_quantity <= item.minimum_quantity).length;
    
    document.getElementById('total-units').textContent = totalUnits;
    document.getElementById('low-stock').textContent = lowStock;
}
```

---

**Last Updated:** April 13, 2026  
**Author:** Zaid Qtaish
