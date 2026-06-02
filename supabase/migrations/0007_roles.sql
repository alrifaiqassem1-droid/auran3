-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0007 — Custom Roles, Audit Log, Invitations
-- AURAN — فقط أنشئ الملف، شغّله يدوياً من Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. custom_roles — أدوار مخصصة لكل tenant مع JSONB للصلاحيات
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  permissions JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

COMMENT ON TABLE  public.custom_roles IS 'أدوار مخصصة لكل tenant مع صلاحيات JSONB';
COMMENT ON COLUMN public.custom_roles.permissions IS
  '{"products":{"view":bool,"add":bool,"edit":bool,"delete":bool},'
  '"receiving":{"view":bool,"add":bool},'
  '"inventory":{"view":bool,"add":bool},'
  '"damage":{"view":bool,"add":bool},'
  '"reports":{"view":bool},'
  '"prices":{"view":bool},'
  '"staff":{"view":bool,"add":bool,"edit":bool,"delete":bool}}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. audit_log — سجل عمليات الأعمال
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT,
  action      TEXT        NOT NULL,
  -- create | update | delete | receive | damage | count_close | pos_import
  -- role_change | invite | remove_staff
  entity      TEXT        NOT NULL,
  -- product | goods_receipts | damaged_products | inventory_counts
  -- pos_import | membership | custom_role
  entity_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx
  ON public.audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx
  ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_action_idx
  ON public.audit_log (entity, action);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. invitations — دعوات الموظفين بصلاحية 48 ساعة
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  custom_role_id UUID        REFERENCES public.custom_roles(id) ON DELETE SET NULL,
  default_role   TEXT        NOT NULL DEFAULT 'staff'
                             CHECK (default_role IN ('owner','manager','staff')),
  invited_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  token          UUID        NOT NULL DEFAULT gen_random_uuid(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  accepted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- دعوة واحدة معلّقة فقط لكل email في كل tenant
CREATE UNIQUE INDEX IF NOT EXISTS invitations_tenant_email_pending_idx
  ON public.invitations (tenant_id, email)
  WHERE accepted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FK — ربط memberships بالدور المخصص (nullable)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS custom_role_id UUID
    REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — Row Level Security على الجداول الثلاثة
-- ─────────────────────────────────────────────────────────────────────────────

-- ── custom_roles ─────────────────────────────────────────────────────────────
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- كل أعضاء الـ tenant يقرأون الأدوار
CREATE POLICY "cr_tenant_select" ON public.custom_roles
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- المالك فقط يُنشئ / يُعدّل / يحذف
CREATE POLICY "cr_owner_insert" ON public.custom_roles
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "cr_owner_update" ON public.custom_roles
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "cr_owner_delete" ON public.custom_roles
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ── audit_log ─────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- المالك يرى كل العمليات في الـ tenant
CREATE POLICY "al_owner_select" ON public.audit_log
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- الموظف يرى عملياته فقط
CREATE POLICY "al_staff_select" ON public.audit_log
  FOR SELECT USING (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- أي عضو يُدرج سجلاً خاصاً به
CREATE POLICY "al_member_insert" ON public.audit_log
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- service_role يتجاوز RLS لتسجيل العمليات من server actions
CREATE POLICY "al_service_role_all" ON public.audit_log
  TO service_role USING (true) WITH CHECK (true);

-- ── invitations ───────────────────────────────────────────────────────────────
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- المالك فقط يرى / يُنشئ / يحذف دعوات tenantه
CREATE POLICY "inv_owner_all" ON public.invitations
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- المدعو يقرأ دعوته بالـ token (للتحقق عند القبول)
CREATE POLICY "inv_token_select" ON public.invitations
  FOR SELECT USING (true);   -- الحماية عبر token فريد + expires_at في التطبيق

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Trigger guard_last_owner — يمنع حذف / تغيير دور آخر مالك
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_last_owner_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    IF (
      SELECT COUNT(*) FROM public.memberships
      WHERE tenant_id = OLD.tenant_id
        AND role = 'owner'
        AND id   != OLD.id
    ) = 0 THEN
      RAISE EXCEPTION 'AURAN_LAST_OWNER: لا يمكن حذف آخر مالك للـ tenant';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_last_owner_delete ON public.memberships;
CREATE TRIGGER trg_guard_last_owner_delete
  BEFORE DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_owner_delete();

-- ──

CREATE OR REPLACE FUNCTION public.guard_last_owner_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    IF (
      SELECT COUNT(*) FROM public.memberships
      WHERE tenant_id = OLD.tenant_id
        AND role = 'owner'
        AND id   != OLD.id
    ) = 0 THEN
      RAISE EXCEPTION 'AURAN_LAST_OWNER: لا يمكن تغيير دور آخر مالك للـ tenant';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_last_owner_update ON public.memberships;
CREATE TRIGGER trg_guard_last_owner_update
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_owner_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7a. Seed 3 أدوار افتراضية لكل tenant موجود الآن
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r_owner JSONB := '{
    "products":  {"view":true,"add":true,"edit":true,"delete":true},
    "receiving": {"view":true,"add":true},
    "inventory": {"view":true,"add":true},
    "damage":    {"view":true,"add":true},
    "reports":   {"view":true},
    "prices":    {"view":true},
    "staff":     {"view":true,"add":true,"edit":true,"delete":true}
  }';
  r_manager JSONB := '{
    "products":  {"view":true,"add":true,"edit":true,"delete":false},
    "receiving": {"view":true,"add":true},
    "inventory": {"view":true,"add":true},
    "damage":    {"view":true,"add":true},
    "reports":   {"view":true},
    "prices":    {"view":true},
    "staff":     {"view":true,"add":false,"edit":false,"delete":false}
  }';
  r_staff JSONB := '{
    "products":  {"view":true,"add":false,"edit":false,"delete":false},
    "receiving": {"view":true,"add":true},
    "inventory": {"view":true,"add":true},
    "damage":    {"view":true,"add":true},
    "reports":   {"view":false},
    "prices":    {"view":false},
    "staff":     {"view":false,"add":false,"edit":false,"delete":false}
  }';
BEGIN
  INSERT INTO public.custom_roles (tenant_id, name, permissions)
  SELECT id, 'Owner',   r_owner   FROM public.tenants
  ON CONFLICT (tenant_id, name) DO NOTHING;

  INSERT INTO public.custom_roles (tenant_id, name, permissions)
  SELECT id, 'Manager', r_manager FROM public.tenants
  ON CONFLICT (tenant_id, name) DO NOTHING;

  INSERT INTO public.custom_roles (tenant_id, name, permissions)
  SELECT id, 'Staff',   r_staff   FROM public.tenants
  ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7b. Trigger — seed الأدوار الثلاثة تلقائياً لكل tenant جديد
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_default_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.custom_roles (tenant_id, name, permissions) VALUES
    (NEW.id, 'Owner', '{
      "products":  {"view":true,"add":true,"edit":true,"delete":true},
      "receiving": {"view":true,"add":true},
      "inventory": {"view":true,"add":true},
      "damage":    {"view":true,"add":true},
      "reports":   {"view":true},
      "prices":    {"view":true},
      "staff":     {"view":true,"add":true,"edit":true,"delete":true}
    }'),
    (NEW.id, 'Manager', '{
      "products":  {"view":true,"add":true,"edit":true,"delete":false},
      "receiving": {"view":true,"add":true},
      "inventory": {"view":true,"add":true},
      "damage":    {"view":true,"add":true},
      "reports":   {"view":true},
      "prices":    {"view":true},
      "staff":     {"view":true,"add":false,"edit":false,"delete":false}
    }'),
    (NEW.id, 'Staff', '{
      "products":  {"view":true,"add":false,"edit":false,"delete":false},
      "receiving": {"view":true,"add":true},
      "inventory": {"view":true,"add":true},
      "damage":    {"view":true,"add":true},
      "reports":   {"view":false},
      "prices":    {"view":false},
      "staff":     {"view":false,"add":false,"edit":false,"delete":false}
    }')
  ON CONFLICT (tenant_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_roles ON public.tenants;
CREATE TRIGGER trg_seed_default_roles
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_roles();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Auto-audit triggers — يسجّل العمليات تلقائياً في audit_log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_auto_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_action TEXT;
  v_tid    UUID;
  v_eid    TEXT;
BEGIN
  v_action := CASE TG_OP
    WHEN 'INSERT' THEN
      CASE TG_TABLE_NAME
        WHEN 'goods_receipts'    THEN 'receive'
        WHEN 'damaged_products'  THEN 'damage'
        ELSE 'create'
      END
    WHEN 'UPDATE' THEN
      CASE TG_TABLE_NAME
        WHEN 'inventory_counts' THEN
          CASE WHEN NEW.status = 'closed' AND OLD.status <> 'closed'
               THEN 'count_close' ELSE 'update'
          END
        ELSE 'update'
      END
    WHEN 'DELETE' THEN 'delete'
  END;

  v_tid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
  v_eid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT  ELSE NEW.id::TEXT  END;

  IF v_tid IS NOT NULL THEN
    INSERT INTO public.audit_log (tenant_id, user_id, action, entity, entity_id)
    VALUES (v_tid, auth.uid(), v_action, TG_TABLE_NAME, v_eid);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_goods_receipts   ON public.goods_receipts;
DROP TRIGGER IF EXISTS trg_audit_damaged_products  ON public.damaged_products;
DROP TRIGGER IF EXISTS trg_audit_inventory_counts  ON public.inventory_counts;

CREATE TRIGGER trg_audit_goods_receipts
  AFTER INSERT ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_audit();

CREATE TRIGGER trg_audit_damaged_products
  AFTER INSERT ON public.damaged_products
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_audit();

CREATE TRIGGER trg_audit_inventory_counts
  AFTER INSERT OR UPDATE ON public.inventory_counts
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_audit();

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 0007
-- ═══════════════════════════════════════════════════════════════════════════
