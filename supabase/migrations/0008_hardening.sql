-- ============================================================
-- 0008_hardening.sql
-- AURAN Security Hardening Migration
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ============================================================
-- 1. LOCK DOWN public SCHEMA
-- Prevent any authenticated user from creating objects
-- in the public schema (Supabase enables this by default)
-- ============================================================
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

-- Re-grant only to postgres/service_role (already implicit)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;


-- ============================================================
-- 2. RESTRICT anon ROLE
-- anon should never touch operational tables directly
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Re-grant only what anon legitimately needs (nothing for AURAN)
-- All access goes through authenticated + RLS


-- ============================================================
-- 3. FIX search_path ON ALL FUNCTIONS
-- Prevents schema injection attacks where a malicious user
-- creates a function with the same name in a different schema
-- ============================================================

-- bootstrap_tenant
ALTER FUNCTION public.bootstrap_tenant(text, text, uuid)
  SET search_path = public, pg_temp;

-- auth_tenant_ids
ALTER FUNCTION public.auth_tenant_ids()
  SET search_path = public, pg_temp;

-- has_role
ALTER FUNCTION public.has_role(uuid, user_role[])
  SET search_path = public, pg_temp;

-- _guard
ALTER FUNCTION public._guard(uuid, user_role[])
  SET search_path = public, pg_temp;

-- receive_goods
ALTER FUNCTION public.receive_goods(jsonb)
  SET search_path = public, pg_temp;

-- record_damage
ALTER FUNCTION public.record_damage(jsonb)
  SET search_path = public, pg_temp;

-- close_count
ALTER FUNCTION public.close_count(jsonb)
  SET search_path = public, pg_temp;

-- apply_pos_import
ALTER FUNCTION public.apply_pos_import(jsonb)
  SET search_path = public, pg_temp;

-- fn_auto_audit (trigger function)
ALTER FUNCTION public.fn_auto_audit()
  SET search_path = public, pg_temp;


-- ============================================================
-- 4. VERIFY RLS IS ENABLED ON ALL OPERATIONAL TABLES
-- This does NOT enable RLS — it raises a notice if missing
-- so you can catch any table added without RLS
-- ============================================================
DO $$
DECLARE
  tbl record;
  missing_rls text[] := '{}';
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations', 'processed_ops')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE relname = tbl.tablename
        AND relnamespace = 'public'::regnamespace
        AND relrowsecurity = true
    ) THEN
      missing_rls := array_append(missing_rls, tbl.tablename);
    END IF;
  END LOOP;

  IF array_length(missing_rls, 1) > 0 THEN
    RAISE WARNING 'AURAN HARDENING: RLS NOT enabled on: %', array_to_string(missing_rls, ', ');
  ELSE
    RAISE NOTICE 'AURAN HARDENING: RLS verified on all public tables ✓';
  END IF;
END $$;


-- ============================================================
-- 5. FORCE RLS ON SENSITIVE TABLES (safety net)
-- Even if already enabled, ALTER TABLE ... FORCE ROW LEVEL SECURITY
-- ensures table owner (postgres) is also subject to RLS
-- ============================================================
ALTER TABLE public.tenants             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.branches            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.memberships         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.damaged_products    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pos_imports         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pos_import_items    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invitations         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories          FORCE ROW LEVEL SECURITY;


-- ============================================================
-- 6. RESTRICT authenticated ROLE TO MINIMUM
-- authenticated users access data ONLY through RLS policies
-- not through blanket table grants
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Re-grant SELECT/INSERT/UPDATE/DELETE — RLS policies
-- will enforce tenant isolation on top of these grants
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ============================================================
-- 7. LOCK DOWN FUNCTION EXECUTION
-- Only authenticated users can call operational RPCs
-- anon cannot call receive_goods, record_damage, etc.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.receive_goods(jsonb)    FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_damage(jsonb)    FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_count(jsonb)      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_pos_import(jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._guard(uuid, user_role[])    FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.receive_goods(jsonb)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_damage(jsonb)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_count(jsonb)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_pos_import(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_tenant_ids()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, user_role[])  TO authenticated;


-- ============================================================
-- DONE
-- ============================================================
