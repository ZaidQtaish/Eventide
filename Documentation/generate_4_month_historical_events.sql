-- Generate high-volume, realistic historical inventory events for the last 4 months.
-- This script appends events (does not delete existing events).
-- Snapshot is updated automatically by trigger: trg_events_apply_to_snapshot.

BEGIN;

-- Delete existing records
DELETE FROM events;
DELETE FROM snapshot;

DO $$
DECLARE
    pair_rec RECORD;
    d DATE;
    start_date DATE := (CURRENT_DATE - INTERVAL '4 months')::DATE;
    end_date DATE := (CURRENT_DATE - INTERVAL '1 day')::DATE;

    user_id_pick INT;
    current_qty INT;

    weekday_num INT;
    season_multiplier NUMERIC;

    target_seed INT;
    seed_qty INT;

    outbound_qty INT;
    second_outbound_qty INT;
    inbound_qty INT;
    adj_qty INT;

    event_ts TIMESTAMP;
BEGIN
    IF (SELECT COUNT(*) FROM users) = 0 THEN
        RAISE EXCEPTION 'No users found; cannot assign user_id for generated events';
    END IF;

    IF (SELECT COUNT(*) FROM items) = 0 THEN
        RAISE EXCEPTION 'No items found; cannot generate events';
    END IF;

    IF (SELECT COUNT(*) FROM warehouses WHERE status = 'active') = 0 THEN
        RAISE EXCEPTION 'No active warehouses found; cannot generate events';
    END IF;

    -- Generate for most item/warehouse combinations so volume is large but still plausible.
    FOR pair_rec IN
        SELECT
            i.id AS item_id,
            i.minimum_stock,
            COALESCE(i.category, 'General') AS category,
            w.id AS warehouse_id,
            w.code AS warehouse_code
        FROM items i
        JOIN warehouses w ON w.status = 'active'
        WHERE random() < 0.85
        ORDER BY i.id, w.id
    LOOP
        -- Ensure a healthy starting stock near the beginning of the historical window.
        SELECT s.current_quantity
        INTO current_qty
        FROM snapshot s
        WHERE s.item_id = pair_rec.item_id
          AND s.warehouse_id = pair_rec.warehouse_id;

        target_seed := GREATEST(
            pair_rec.minimum_stock * 2,
            pair_rec.minimum_stock + (5 + FLOOR(random() * 35))::INT
        );

        IF current_qty IS NULL OR current_qty < target_seed THEN
            seed_qty := target_seed - COALESCE(current_qty, 0);
            IF seed_qty > 0 THEN
                SELECT id INTO user_id_pick FROM users ORDER BY random() LIMIT 1;

                event_ts := start_date::timestamp + make_interval(hours => 8 + FLOOR(random() * 3)::INT, mins => FLOOR(random() * 60)::INT);

                INSERT INTO events (type, item_id, quantity_change, reason_code, user_id, warehouse_id, timestamp)
                VALUES (
                    'inbound',
                    pair_rec.item_id,
                    seed_qty,
                    'PURCHASE',
                    user_id_pick,
                    pair_rec.warehouse_id,
                    event_ts
                );
            END IF;
        END IF;

        FOR d IN
            SELECT gs::DATE
            FROM generate_series(start_date, end_date, INTERVAL '1 day') gs
        LOOP
            weekday_num := EXTRACT(ISODOW FROM d)::INT;

            season_multiplier := CASE pair_rec.category
                WHEN 'Supplies' THEN 1.35
                WHEN 'Office' THEN 1.10
                WHEN 'Accessories' THEN 1.00
                WHEN 'Cables' THEN 1.15
                WHEN 'Electronics' THEN 0.75
                ELSE 1.00
            END;

            -- Weekends are slower in most warehouses.
            IF weekday_num IN (6, 7) THEN
                season_multiplier := season_multiplier * 0.55;
            END IF;

            -- Month-start bump for supply-heavy operations.
            IF pair_rec.category IN ('Supplies', 'Office') AND EXTRACT(DAY FROM d) <= 5 THEN
                season_multiplier := season_multiplier * 1.25;
            END IF;

            SELECT id INTO user_id_pick FROM users ORDER BY random() LIMIT 1;

            SELECT COALESCE(s.current_quantity, 0)
            INTO current_qty
            FROM snapshot s
            WHERE s.item_id = pair_rec.item_id
              AND s.warehouse_id = pair_rec.warehouse_id;

            -- Primary outbound movement (sales/consumption), bounded by current stock.
            outbound_qty := FLOOR(
                GREATEST(1, pair_rec.minimum_stock * (0.35 + random() * 1.10) * season_multiplier)
            )::INT;

            IF random() < 0.20 THEN
                outbound_qty := outbound_qty + (1 + FLOOR(random() * 8))::INT;
            END IF;

            outbound_qty := LEAST(outbound_qty, GREATEST(0, current_qty - FLOOR(pair_rec.minimum_stock * 0.15)::INT));

            IF outbound_qty > 0 AND random() < 0.90 THEN
                event_ts := d::timestamp + make_interval(hours => 10 + FLOOR(random() * 8)::INT, mins => FLOOR(random() * 60)::INT);

                INSERT INTO events (type, item_id, quantity_change, reason_code, user_id, warehouse_id, timestamp)
                VALUES (
                    'outbound',
                    pair_rec.item_id,
                    -outbound_qty,
                    CASE WHEN random() < 0.94 THEN 'SALE' ELSE 'DAMAGE' END,
                    user_id_pick,
                    pair_rec.warehouse_id,
                    event_ts
                );

                current_qty := current_qty - outbound_qty;
            END IF;

            -- Occasional second outbound on busy weekdays.
            IF weekday_num <= 5 AND random() < 0.18 THEN
                second_outbound_qty := FLOOR(GREATEST(1, outbound_qty * (0.20 + random() * 0.35)))::INT;
                second_outbound_qty := LEAST(second_outbound_qty, GREATEST(0, current_qty));

                IF second_outbound_qty > 0 THEN
                    event_ts := d::timestamp + make_interval(hours => 16 + FLOOR(random() * 4)::INT, mins => FLOOR(random() * 60)::INT);

                    INSERT INTO events (type, item_id, quantity_change, reason_code, user_id, warehouse_id, timestamp)
                    VALUES (
                        'outbound',
                        pair_rec.item_id,
                        -second_outbound_qty,
                        'SALE',
                        user_id_pick,
                        pair_rec.warehouse_id,
                        event_ts
                    );

                    current_qty := current_qty - second_outbound_qty;
                END IF;
            END IF;

            -- Replenishment if low stock or scheduled receiving day.
            IF current_qty < FLOOR(pair_rec.minimum_stock * 1.40)::INT
               OR (weekday_num IN (1, 4) AND random() < 0.65)
            THEN
                inbound_qty := FLOOR(
                    GREATEST(2, pair_rec.minimum_stock * (0.80 + random() * 2.20) * (0.85 + random() * 0.50))
                )::INT;

                IF random() < 0.14 THEN
                    inbound_qty := inbound_qty + (2 + FLOOR(random() * 14))::INT;
                END IF;

                event_ts := d::timestamp + make_interval(hours => 7 + FLOOR(random() * 5)::INT, mins => FLOOR(random() * 60)::INT);

                INSERT INTO events (type, item_id, quantity_change, reason_code, user_id, warehouse_id, timestamp)
                VALUES (
                    'inbound',
                    pair_rec.item_id,
                    inbound_qty,
                    CASE WHEN random() < 0.90 THEN 'PURCHASE' ELSE 'RETURN' END,
                    user_id_pick,
                    pair_rec.warehouse_id,
                    event_ts
                );

                current_qty := current_qty + inbound_qty;
            END IF;

            -- Small, realistic stock-check adjustments only.
            IF random() < 0.05 THEN
                adj_qty := (FLOOR(random() * 7)::INT - 3); -- range: -3..+3
                IF adj_qty <> 0 THEN
                    IF current_qty + adj_qty < 0 THEN
                        adj_qty := -current_qty;
                    END IF;

                    event_ts := d::timestamp + make_interval(hours => 18 + FLOOR(random() * 3)::INT, mins => FLOOR(random() * 60)::INT);

                    INSERT INTO events (type, item_id, quantity_change, reason_code, user_id, warehouse_id, timestamp)
                    VALUES (
                        'adjustment',
                        pair_rec.item_id,
                        adj_qty,
                        'STOCK_CHECK',
                        user_id_pick,
                        pair_rec.warehouse_id,
                        event_ts
                    );
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END
$$;

COMMIT;

-- Optional sanity checks after running:
-- SELECT COUNT(*) AS total_events FROM events;
-- SELECT type, COUNT(*) FROM events GROUP BY type ORDER BY 2 DESC;
-- SELECT COUNT(*) AS negative_snapshot_rows FROM snapshot WHERE current_quantity < 0;
