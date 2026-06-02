-- ============================================================================
-- AURAN · الإشعارات الذكية — Triggers + RPC الفحص الصباحي
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) trigger: مخزون منخفض — بعد كل حركة مخزون سالبة
-- ---------------------------------------------------------------------------
create or replace function _notify_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_product  record;
  v_total    numeric(12,3);
  v_body     text;
begin
  -- نتحقق فقط من حركات الخروج
  if NEW.quantity >= 0 then return NEW; end if;

  select id, name, low_stock_threshold, tenant_id
    into v_product from products where id = NEW.product_id;

  if v_product.low_stock_threshold <= 0 then return NEW; end if;

  select coalesce(sum(quantity), 0) into v_total
    from stock_batches
    where product_id = NEW.product_id and branch_id = NEW.branch_id and quantity > 0;

  if v_total > v_product.low_stock_threshold then return NEW; end if;

  -- منع تكرار الإشعار خلال ساعة
  if exists (
    select 1 from notifications
    where tenant_id = NEW.tenant_id and branch_id = NEW.branch_id
      and type = 'low_stock'
      and body like '%' || NEW.product_id::text || '%'
      and created_at > now() - interval '1 hour'
  ) then return NEW; end if;

  v_body := 'qty:' || round(v_total, 3)::text || '|pid:' || NEW.product_id::text;

  insert into notifications(tenant_id, branch_id, user_id, type, title, body)
  values (
    NEW.tenant_id, NEW.branch_id, null,
    'low_stock',
    v_product.name || ' — مخزون منخفض',
    v_body
  );

  return NEW;
end; $$;

drop trigger if exists trg_low_stock on stock_movements;
create trigger trg_low_stock
  after insert on stock_movements
  for each row execute function _notify_low_stock();

-- ---------------------------------------------------------------------------
-- 2) trigger: تأكيد الاستلام — إشعار عند إنشاء وصل جديد
-- ---------------------------------------------------------------------------
create or replace function _notify_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(tenant_id, branch_id, user_id, type, title, body)
  values (
    NEW.tenant_id, NEW.branch_id, null,
    'receipt',
    'استلام بضاعة جديد',
    'المرجع: ' || coalesce(NEW.reference, 'بدون مرجع')
  );
  return NEW;
end; $$;

drop trigger if exists trg_receipt_notif on goods_receipts;
create trigger trg_receipt_notif
  after insert on goods_receipts
  for each row execute function _notify_receipt();

-- ---------------------------------------------------------------------------
-- 3) RPC: check_expiry_notifications — الفحص الصباحي للصلاحيات
-- يُستدعى من العميل عند فتح التطبيق (إن مرّ 6 ساعات على آخر فحص)
-- ---------------------------------------------------------------------------
create or replace function check_expiry_notifications(p_branch_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_batch  record;
  v_count  int := 0;
begin
  select tenant_id into v_tenant from branches where id = p_branch_id;
  if v_tenant is null then return 0; end if;

  if not has_role(v_tenant, array['owner','manager','staff']::user_role[]) then
    return 0;
  end if;

  -- دفعات تنتهي خلال 7 أيام (حرجة)
  for v_batch in
    select sb.id, sb.expiry_date, p.name
    from stock_batches sb
    join products p on p.id = sb.product_id
    where sb.tenant_id = v_tenant
      and sb.branch_id = p_branch_id
      and sb.quantity > 0
      and sb.expiry_date is not null
      and sb.expiry_date between current_date and current_date + 7
      and not exists (
        select 1 from notifications n
        where n.tenant_id = v_tenant and n.branch_id = p_branch_id
          and n.type = 'expiry_soon'
          and n.body like '%' || sb.id::text || '%'
          and n.created_at > now() - interval '24 hours'
      )
  loop
    insert into notifications(tenant_id, branch_id, user_id, type, title, body)
    values (
      v_tenant, p_branch_id, null,
      'expiry_soon',
      v_batch.name || ' — ينتهي خلال 7 أيام',
      'exp:' || v_batch.expiry_date::text || '|bid:' || v_batch.id::text
    );
    v_count := v_count + 1;
  end loop;

  -- دفعات تنتهي خلال 8–30 يوماً (تحذير)
  for v_batch in
    select sb.id, sb.expiry_date, p.name
    from stock_batches sb
    join products p on p.id = sb.product_id
    where sb.tenant_id = v_tenant
      and sb.branch_id = p_branch_id
      and sb.quantity > 0
      and sb.expiry_date is not null
      and sb.expiry_date between current_date + 8 and current_date + 30
      and not exists (
        select 1 from notifications n
        where n.tenant_id = v_tenant and n.branch_id = p_branch_id
          and n.type = 'expiry_soon'
          and n.body like '%' || sb.id::text || '%'
          and n.created_at > now() - interval '72 hours'
      )
  loop
    insert into notifications(tenant_id, branch_id, user_id, type, title, body)
    values (
      v_tenant, p_branch_id, null,
      'expiry_soon',
      v_batch.name || ' — ينتهي خلال 30 يوماً',
      'exp:' || v_batch.expiry_date::text || '|bid:' || v_batch.id::text
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end; $$;

grant execute on function check_expiry_notifications(uuid) to authenticated;
