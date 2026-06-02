-- ============================================================
-- 0012 · Add status column to goods_receipts + re-apply fixed trigger
-- ============================================================
-- fn_auto_audit accessed NEW.status which throws
-- "record new has no field status" on goods_receipts.
-- Fix 1: add status column so the trigger doesn't fail.
-- Fix 2: re-apply safe trigger that uses to_jsonb(NEW)->>'status'.
-- ============================================================

ALTER TABLE public.goods_receipts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Re-apply the safe version of fn_auto_audit (idempotent)
CREATE OR REPLACE FUNCTION public.fn_auto_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_action     TEXT;
  v_tid        UUID;
  v_eid        TEXT;
  v_new_status TEXT;
  v_old_status TEXT;
BEGIN
  v_new_status := CASE WHEN TG_OP <> 'DELETE' THEN (to_jsonb(NEW)->>'status') ELSE NULL END;
  v_old_status := CASE WHEN TG_OP =  'UPDATE'  THEN (to_jsonb(OLD)->>'status') ELSE NULL END;

  v_action := CASE TG_OP
    WHEN 'INSERT' THEN
      CASE TG_TABLE_NAME
        WHEN 'goods_receipts'   THEN 'receive'
        WHEN 'damaged_products' THEN 'damage'
        ELSE 'create'
      END
    WHEN 'UPDATE' THEN
      CASE TG_TABLE_NAME
        WHEN 'inventory_counts' THEN
          CASE WHEN v_new_status = 'closed' AND v_old_status <> 'closed'
               THEN 'count_close' ELSE 'update'
          END
        ELSE 'update'
      END
    WHEN 'DELETE' THEN 'delete'
    ELSE 'update'
  END;

  v_tid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
  v_eid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT  ELSE NEW.id::TEXT  END;

  IF v_tid IS NOT NULL THEN
    INSERT INTO public.audit_log(tenant_id, user_id, action, entity, entity_id)
    VALUES (v_tid, auth.uid(), v_action, TG_TABLE_NAME, v_eid)
    ON CONFLICT DO NOTHING;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
