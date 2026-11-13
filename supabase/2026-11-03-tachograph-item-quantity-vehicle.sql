-- =====================================================
-- Tachograph module — quantity, unit price, per-line vehicle
-- =====================================================
-- An article line is now "what was done, on which vehicle, how many, at what
-- price":
--
--   operation_type_id  the article
--   vehicle_id         the vehicle the line was done on (nullable for rows
--                      created before this migration; they fall back to the
--                      operation's vehicle)
--   quantity           units (default 1)
--   unit_price         price per unit, HT
--   price              line total HT = quantity * unit_price (written by the API)
--
-- The operation header keeps the first line's vehicle and article so the list
-- filters, the vehicle column and the due-date logic keep working unchanged.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

ALTER TABLE tacho_operation_items
  ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) CHECK (unit_price >= 0);

-- Rows created before this migration already carry their line total in `price`
-- and belong to their operation's vehicle.
UPDATE tacho_operation_items
   SET unit_price = price
 WHERE unit_price IS NULL;

UPDATE tacho_operation_items i
   SET vehicle_id = o.vehicle_id
  FROM tacho_operations o
 WHERE i.operation_id = o.id
   AND i.vehicle_id IS NULL
   AND o.vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tacho_operation_items_vehicle
  ON tacho_operation_items(vehicle_id);

COMMENT ON COLUMN tacho_operation_items.price IS 'Line total HT (quantity x unit_price)';
COMMENT ON COLUMN tacho_operation_items.unit_price IS 'Price per unit, HT';
COMMENT ON COLUMN tacho_operation_items.vehicle_id IS 'Vehicle this line was done on';

COMMIT;
