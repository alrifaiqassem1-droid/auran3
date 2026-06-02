-- ═══════════════════════════════════════════════════════════════
-- AURAN — Roles, Audit Log & Invitations Migration
-- Apply in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. custom_roles — tenant-defined roles with JSONB permissions
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Link memberships to a custom role (optional – falls back to role enum)
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- ───────────────────────────────────────────────────────────────
-- 2. audit_log — business-operation audit trail
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT,
  action      TEXT NOT NULL,   -- 'create','update','delete','receive','damage','count_close','pos_import','role_change','invite','remove_staff'
  entity      TEXT NOT NULL,   -- 'product','receipt','damage','inventory_count','pos_import','membership'
  entity_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_tenant_idx  ON public.audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS audit_log_user_idx    ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx  ON public.audit_log(entity, action);

-- ───────────────────────────────────────────────────────────────
-- 3. invitations — staff invite tokens (48h expiry)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  custom_role_id  UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL,
  default_role    TEXT NOT NULL DEFAULT 'staff',  -- owner/manager/staff enum fallback
  invited_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token           UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invitations_tenant_email_idx
  ON public.invitations(tenant_id, email)
  WHERE accepted_at IS NULL;

-- ───────────────────────────────────────────────────────────────
-- 4. RLS — custom_roles
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_roles_select" ON public.custom_roles
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "custom_roles_owner_insert" ON public.custom_roles
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role = 'owner'
    )
  );

CREATE POLICY "custom_roles_owner_update" ON public.custom_roles
  FOR UPDATE USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role = 'owner'
    )
  );

CREATE POLICY "custom_roles_owner_delete" ON public.custom_roles
  FOR DELETE USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role = 'owner'
    )
  );

-- ───────────────────────────────────────────────────────────────
-- 5. RLS — audit_log
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Owners see all logs for their tenant
CREATE POLICY "audit_log_owner_select" ON public.audit_log
  FOR SELECT USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role = 'owner'
    )
  );

-- Staff see only their own entries
CREATE POLICY "audit_log_staff_select" ON public.audit_log
  FOR SELECT USING (
    user_id = auth.uid() AND
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

-- Any tenant member can insert their own log entries
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

-- Service role bypass (for server-side inserts via server actions)
CREATE POLICY "audit_log_service_all" ON public.audit_log
  TO service_role USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────
-- 6. RLS — invitations
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_owner_all" ON public.invitations
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role = 'owner'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role = 'owner'
    )
  );

-- ───────────────────────────────────────────────────────────────
-- 7. Trigger — prevent deletion of last owner
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_last_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    IF (
      SELECT COUNT(*) FROM public.memberships
      WHERE tenant_id = OLD.tenant_id AND role = 'owner' AND id != OLD.id
    ) = 0 THEN
      RAISE EXCEPTION 'AURAN_LAST_OWNER: Cannot remove the last owner of a tenant';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_last_owner_delete ON public.memberships;
CREATE TRIGGER guard_last_owner_delete
  BEFORE DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_owner();

CREATE OR REPLACE FUNCTION public.guard_last_owner_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    IF (
      SELECT COUNT(*) FROM public.memberships
      WHERE tenant_id = OLD.tenant_id AND role = 'owner' AND id != OLD.id
    ) = 0 THEN
      RAISE EXCEPTION 'AURAN_LAST_OWNER: Cannot change role of the last owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_last_owner_update ON public.memberships;
CREATE TRIGGER guard_last_owner_update
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_owner_update();

-- ───────────────────────────────────────────────────────────────
-- 8. Auto-audit triggers for business operations
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_auto_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_action  TEXT;
  v_entity  TEXT;
  v_tid     UUID;
  v_eid     TEXT;
BEGIN
  v_action := CASE TG_OP
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN
      CASE TG_TABLE_NAME
        WHEN 'inventory_counts' THEN
          CASE WHEN (to_jsonb(NEW)->>'status') = 'closed' AND (to_jsonb(OLD)->>'status') != 'closed' THEN 'count_close' ELSE 'update' END
        ELSE 'update'
      END
    WHEN 'DELETE' THEN 'delete'
  END;

  v_entity := TG_TABLE_NAME;
  v_tid    := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END,
    NULL
  );
  v_eid    := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT ELSE NEW.id::TEXT END;

  IF v_tid IS NOT NULL THEN
    INSERT INTO public.audit_log(tenant_id, user_id, action, entity, entity_id)
    VALUES (v_tid, auth.uid(), v_action, v_entity, v_eid)
    ON CONFLICT DO NOTHING;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Goods receipts
DROP TRIGGER IF EXISTS trg_audit_goods_receipts ON public.goods_receipts;
CREATE TRIGGER trg_audit_goods_receipts
  AFTER INSERT ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_audit();

-- Damaged products
DROP TRIGGER IF EXISTS trg_audit_damaged_products ON public.damaged_products;
CREATE TRIGGER trg_audit_damaged_products
  AFTER INSERT ON public.damaged_products
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_audit();

-- Inventory counts (track close event)
DROP TRIGGER IF EXISTS trg_audit_inventory_counts ON public.inventory_counts;
CREATE TRIGGER trg_audit_inventory_counts
  AFTER INSERT OR UPDATE ON public.inventory_counts
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_audit();

-- ───────────────────────────────────────────────────────────────
-- 9. Seed default custom roles for all existing tenants
-- ───────────────────────────────────────────────────────────────
INSERT INTO public.custom_roles (tenant_id, name, permissions)
SELECT t.id, 'مالك', '{
  "products":  {"view":true,"add":true,"edit":true,"delete":true},
  "receiving": {"view":true,"add":true},
  "inventory": {"view":true,"add":true},
  "damage":    {"view":true,"add":true},
  "reports":   {"view":true},
  "prices":    {"view":true},
  "staff":     {"view":true,"add":true,"edit":true,"delete":true}
}'::JSONB
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.custom_roles (tenant_id, name, permissions)
SELECT t.id, 'مدير', '{
  "products":  {"view":true,"add":true,"edit":true,"delete":false},
  "receiving": {"view":true,"add":true},
  "inventory": {"view":true,"add":true},
  "damage":    {"view":true,"add":true},
  "reports":   {"view":true},
  "prices":    {"view":true},
  "staff":     {"view":true,"add":false,"edit":false,"delete":false}
}'::JSONB
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.custom_roles (tenant_id, name, permissions)
SELECT t.id, 'موظف', '{
  "products":  {"view":true,"add":false,"edit":false,"delete":false},
  "receiving": {"view":true,"add":true},
  "inventory": {"view":true,"add":true},
  "damage":    {"view":true,"add":true},
  "reports":   {"view":false},
  "prices":    {"view":false},
  "staff":     {"view":false,"add":false,"edit":false,"delete":false}
}'::JSONB
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;
