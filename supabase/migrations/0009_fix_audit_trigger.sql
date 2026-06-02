-- ============================================================
-- 0009 · Add status column to damaged_products
-- ============================================================
-- fn_auto_audit trigger reads NEW.status; damaged_products lacked
-- this column causing "record new has no field status" error.
-- ============================================================

ALTER TABLE damaged_products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
