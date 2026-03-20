-- Create Warehouses table
CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);

-- Create Suppliers table
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(100)
);

-- Create Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20)
);

-- Create Items table
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    minimum_stock INT DEFAULT 10,
    category VARCHAR(50),
    supplier_id INT REFERENCES suppliers(id)
);

-- Create Stock Snapshots table
CREATE TABLE snapshot (
    item_id INT REFERENCES items(id),
    warehouse_id INT REFERENCES warehouses(id),
    current_quantity INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_id, warehouse_id)
);

-- Create Events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    item_id INT NOT NULL REFERENCES items(id),
    quantity_change INT NOT NULL,
    reason_code VARCHAR(50),
    user_id INT REFERENCES users(id),
    warehouse_id INT REFERENCES warehouses(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_events_item_id ON events(item_id);
CREATE INDEX idx_events_warehouse_id ON events(warehouse_id);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_snapshot_warehouse_id ON snapshot(warehouse_id);
CREATE INDEX idx_items_supplier_id ON items(supplier_id);

-- Insert dummy data

-- Warehouses
INSERT INTO warehouses (code, status) VALUES
('WH-CENTRAL', 'active'),
('WH-NORTH', 'active'),
('WH-SOUTH', 'inactive'),
('WH-EAST', 'active'),
('WH-WEST', 'active');

-- Suppliers
INSERT INTO suppliers (name, phone_number, email) VALUES
('TechSupply Co.', '555-0101', 'sales@techsupply.com'),
('GlobalLogistics Inc.', '555-0102', 'contact@globallogistics.com'),
('FastTrack Distribution', '555-0103', 'info@fasttrack.com'),
('Premium Parts Ltd.', '555-0104', 'support@premiumparts.com'),
('EcoGoods Supply', '555-0105', 'hello@ecogoods.com');

-- Users
INSERT INTO users (name, role, username, password_hash, phone_number) VALUES
('Alice Johnson', 'admin', 'alice_j', 'hashed_password_1', '555-1001'),
('Bob Smith', 'warehouse_manager', 'bob_smith', 'hashed_password_2', '555-1002'),
('Carol Davis', 'inventory_clerk', 'carol_d', 'hashed_password_3', '555-1003'),
('David Wilson', 'warehouse_manager', 'david_w', 'hashed_password_4', '555-1004'),
('Emma Brown', 'inventory_clerk', 'emma_b', 'hashed_password_5', '555-1005');

-- Items
INSERT INTO items (name, sku, description, minimum_stock, category, supplier_id) VALUES
('Laptop Pro 15', 'TECH-001', 'High-performance laptop with 15-inch display', 5, 'Electronics', 1),
('Wireless Mouse', 'TECH-002', 'Ergonomic wireless mouse with USB receiver', 30, 'Accessories', 1),
('USB-C Cable', 'TECH-003', '2-meter USB-C charging cable', 50, 'Cables', 1),
('Monitor Stand', 'TECH-004', 'Adjustable dual monitor stand', 10, 'Accessories', 2),
('Keyboard Mechanical', 'TECH-005', 'RGB mechanical gaming keyboard', 15, 'Accessories', 1),
('Desk Lamp LED', 'OFF-001', 'Energy-efficient LED desk lamp', 20, 'Office', 3),
('Printer A4', 'OFF-002', 'Inkjet printer for office use', 8, 'Office', 2),
('Paper Ream A4', 'OFF-003', '500 sheets of A4 paper', 100, 'Supplies', 4),
('Pen Pack (12)', 'OFF-004', 'Box of 12 ballpoint pens', 40, 'Supplies', 5),
('Notebook A5', 'OFF-005', 'Spiral-bound notebook 100 pages', 60, 'Supplies', 4);

-- Stock Snapshots
INSERT INTO snapshot (item_id, warehouse_id, current_quantity, last_updated) VALUES
(1, 1, 25, CURRENT_TIMESTAMP),
(1, 2, 12, CURRENT_TIMESTAMP),
(1, 4, 8, CURRENT_TIMESTAMP),
(2, 1, 150, CURRENT_TIMESTAMP),
(2, 2, 75, CURRENT_TIMESTAMP),
(2, 4, 90, CURRENT_TIMESTAMP),
(3, 1, 200, CURRENT_TIMESTAMP),
(3, 2, 180, CURRENT_TIMESTAMP),
(3, 4, 120, CURRENT_TIMESTAMP),
(4, 1, 15, CURRENT_TIMESTAMP),
(4, 2, 8, CURRENT_TIMESTAMP),
(5, 1, 35, CURRENT_TIMESTAMP),
(5, 2, 22, CURRENT_TIMESTAMP),
(6, 1, 40, CURRENT_TIMESTAMP),
(6, 4, 25, CURRENT_TIMESTAMP),
(7, 1, 5, CURRENT_TIMESTAMP),
(7, 2, 3, CURRENT_TIMESTAMP),
(8, 1, 300, CURRENT_TIMESTAMP),
(8, 2, 450, CURRENT_TIMESTAMP),
(9, 1, 120, CURRENT_TIMESTAMP),
(9, 4, 85, CURRENT_TIMESTAMP),
(10, 1, 200, CURRENT_TIMESTAMP),
(10, 2, 150, CURRENT_TIMESTAMP);

-- Events (inventory transactions)
INSERT INTO events (type, item_id, quantity_change, reason_code, user_id, warehouse_id, timestamp) VALUES
('inbound', 1, 25, 'PURCHASE', 1, 1, CURRENT_TIMESTAMP - INTERVAL '7 days'),
('inbound', 2, 150, 'PURCHASE', 2, 1, CURRENT_TIMESTAMP - INTERVAL '6 days'),
('outbound', 1, 5, 'SALE', 3, 1, CURRENT_TIMESTAMP - INTERVAL '5 days'),
('adjustment', 3, 10, 'RESTOCK', 1, 1, CURRENT_TIMESTAMP - INTERVAL '4 days'),
('inbound', 4, 15, 'PURCHASE', 4, 1, CURRENT_TIMESTAMP - INTERVAL '3 days'),
('outbound', 2, 25, 'SALE', 3, 1, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('transfer', 1, -5, 'WAREHOUSE_TRANSFER', 2, 1, CURRENT_TIMESTAMP - INTERVAL '1 days'),
('inbound', 5, 35, 'PURCHASE', 1, 1, CURRENT_TIMESTAMP),
('outbound', 3, 30, 'SALE', 5, 2, CURRENT_TIMESTAMP),
('adjustment', 6, 5, 'STOCK_CHECK', 4, 1, CURRENT_TIMESTAMP - INTERVAL '12 hours'),
('inbound', 7, 5, 'PURCHASE', 2, 1, CURRENT_TIMESTAMP - INTERVAL '10 hours'),
('outbound', 4, 2, 'SALE', 3, 2, CURRENT_TIMESTAMP - INTERVAL '8 hours'),
('transfer', 2, 15, 'WAREHOUSE_TRANSFER', 1, 2, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
('inbound', 8, 300, 'PURCHASE', 4, 1, CURRENT_TIMESTAMP - INTERVAL '5 hours'),
('outbound', 5, 8, 'SALE', 5, 1, CURRENT_TIMESTAMP - INTERVAL '3 hours');
