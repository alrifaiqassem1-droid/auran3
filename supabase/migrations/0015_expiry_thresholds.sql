-- 0015_expiry_thresholds.sql
-- Per-product expiry alert thresholds with category-level defaults.
-- No RLS changes — existing policies on categories and products already cover new columns.

-- ── categories: default thresholds ──────────────────────────────────────────
alter table categories
  add column default_critical_days integer not null default 7,
  add column default_warning_days  integer not null default 30;

-- ── products: per-product overrides (null = use category default) ────────────
alter table products
  add column expiry_critical_days integer,
  add column expiry_warning_days  integer;

-- ── constraints: sanity-check that days are positive if set ─────────────────
alter table categories
  add constraint categories_critical_days_positive check (default_critical_days > 0),
  add constraint categories_warning_days_positive  check (default_warning_days  > 0);

alter table products
  add constraint products_critical_days_positive check (expiry_critical_days is null or expiry_critical_days > 0),
  add constraint products_warning_days_positive  check (expiry_warning_days  is null or expiry_warning_days  > 0);
