-- ============================================================
-- 0011 · Fix fn_auto_audit: safe NEW.status access
-- ============================================================
-- Problem: the trigger accessed NEW.status directly which throws
--   "record new has no field status" on tables like damaged_products
--   that don't have a status column.
-- Fix: use to_jsonb(NEW)->>'status' which returns NULL (not error)
--   for tables that don't have a status column.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_auto_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_action  TEXT;
  v_tid     UUID;
  v_eid     TEXT;
  v_new_status TEXT;
  v_old_status TEXT;
BEGIN
  -- Safe status extraction — returns NULL for tables without status column
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

-- Re-attach triggers (function body changed, triggers point to same function name — no DROP needed)
-- But we re-create to ensure correct firing events:

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
