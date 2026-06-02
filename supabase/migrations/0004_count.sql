-- ============================================================================
-- AURAN · الجرد — RPCs المساعدة
-- open_count   : فتح جلسة جرد جديدة
-- upsert_count_item : إضافة/تحديث سطر جرد مع حساب expected_qty
--
-- close_count موجود في 0010_core_rpcs.sql (نواة الصحّة المقفولة)
-- ============================================================================

-- قيد فريد يدعم ON CONFLICT في upsert_count_item
alter table inventory_count_items
  add constraint ici_count_product_unique unique (count_id, product_id);

-- ===========================================================================
-- open_count — فتح جلسة جرد جديدة للفرع
-- يعيد: uuid (id الجلسة الجديدة)
-- ===========================================================================
create or replace function open_count(p_branch_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_count  uuid;
begin
  select tenant_id into v_tenant from branches where id = p_branch_id;
  if v_tenant is null then raise exception 'AURAN_BAD_BRANCH'; end if;

  if not exists (
    select 1 from memberships
    where user_id = auth.uid()
      and tenant_id = v_tenant
      and role = any(array['owner','manager','staff']::user_role[])
  ) then
    raise exception 'AURAN_FORBIDDEN';
  end if;

  insert into inventory_counts(tenant_id, branch_id, status, created_by)
  values (v_tenant, p_branch_id, 'open', auth.uid())
  returning id into v_count;

  return v_count;
end; $$;

-- ===========================================================================
-- upsert_count_item — إضافة/تحديث سطر في جلسة جرد
-- يحسب expected_qty من مجموع الدفعات لحظة الإدراج الأول فقط.
-- الإدراجات اللاحقة تحدّث counted_qty فقط.
-- يعيد: { item_id, expected_qty }
-- ===========================================================================
create or replace function upsert_count_item(
  p_count_id   uuid,
  p_product_id uuid,
  p_counted    numeric
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tenant   uuid;
  v_branch   uuid;
  v_expected numeric(12,3);
  v_item_id  uuid;
begin
  select tenant_id, branch_id into v_tenant, v_branch
    from inventory_counts where id = p_count_id;
  if v_tenant is null then raise exception 'AURAN_BAD_COUNT'; end if;

  if not exists (
    select 1 from memberships
    where user_id = auth.uid()
      and tenant_id = v_tenant
      and role = any(array['owner','manager','staff']::user_role[])
  ) then
    raise exception 'AURAN_FORBIDDEN';
  end if;

  if (select status from inventory_counts where id = p_count_id) = 'closed' then
    raise exception 'AURAN_COUNT_CLOSED';
  end if;

  -- الكمية المتوقعة من مجموع الدفعات الحالية (تُحسب عند الإدراج الأول)
  -- أو نستخدم القيمة المخزّنة إن كان السطر موجوداً
  select coalesce(
    (select expected_qty from inventory_count_items
      where count_id = p_count_id and product_id = p_product_id),
    (select coalesce(sum(quantity), 0) from stock_batches
      where tenant_id = v_tenant and branch_id = v_branch
        and product_id = p_product_id and quantity > 0)
  ) into v_expected;

  insert into inventory_count_items(count_id, product_id, expected_qty, counted_qty)
  values (p_count_id, p_product_id, v_expected, p_counted)
  on conflict (count_id, product_id)
  do update set counted_qty = excluded.counted_qty
  returning id, expected_qty into v_item_id, v_expected;

  return jsonb_build_object('item_id', v_item_id, 'expected_qty', v_expected);
end; $$;

grant execute on function open_count(uuid) to authenticated;
grant execute on function upsert_count_item(uuid, uuid, numeric) to authenticated;
