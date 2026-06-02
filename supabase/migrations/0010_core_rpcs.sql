-- ============================================================================
-- AURAN · نواة الصحّة في قاعدة البيانات — RPCs ذرّية  (كود حرفي مقفول)
-- المسار النهائي: supabase/migrations/0010_core_rpcs.sql
--
-- لماذا داخل Postgres؟ لضمان الذرّية (كل-أو-لا-شيء) وعدم وجود حالة نصفية
-- عند انقطاع الشبكة أو الخطأ، ومنع سباقات تعديل نفس الدفعة من جهازين.
--
-- يفترض هذا الملف وجود جداول و دوال PHASE 03:
--   tenants, branches, products, stock_batches, stock_movements,
--   goods_receipts, goods_receipt_items, damaged_products,
--   inventory_counts, inventory_count_items, pos_imports, pos_import_items,
--   notifications, has_role(), auth_tenant_ids().
-- يُطبّق بعد 0001_init.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Idempotency: منع تكرار تنفيذ نفس العملية (مهم للـ Offline Queue)
-- العميل يولّد client_op_id (uuid) لكل عملية. إن وصلت مرتين (إعادة مزامنة)
-- نعيد النتيجة المخزّنة بدل التنفيذ مرة أخرى.
-- ---------------------------------------------------------------------------
create table if not exists processed_ops (
  client_op_id uuid primary key,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  user_id      uuid not null,
  op_type      text not null,
  result       jsonb not null,
  created_at   timestamptz not null default now()
);
alter table processed_ops enable row level security;
create policy "po_select" on processed_ops for select
  using (tenant_id in (select auth_tenant_ids()));

-- حارس مشترك: تحقّق العضوية والدور، وأعد نتيجة مخزّنة إن وُجدت.
-- يُستدعى داخل كل RPC.
create or replace function _guard(p_tenant uuid, p_roles user_role[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_tenant, p_roles) then
    raise exception 'AURAN_FORBIDDEN: insufficient role for tenant %', p_tenant
      using errcode = '42501';
  end if;
end; $$;

-- ===========================================================================
-- 1) receive_goods — استلام بضاعة (ينشئ دفعات + حركات دخول)  [PHASE 07]
-- المدخل p_payload (jsonb):
-- {
--   "client_op_id": "uuid",
--   "branch_id": "uuid",
--   "supplier_id": "uuid|null",
--   "reference": "text|null",
--   "lines": [
--     { "product_id":"uuid", "quantity":12.000, "cost_price":8.500,
--       "expiry_date":"2026-09-01" | null }
--   ]
-- }
-- يعيد: { "receipt_id": "...", "batches": n, "total_cost": x }
-- ===========================================================================
create or replace function receive_goods(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tenant     uuid;
  v_branch     uuid := (p_payload->>'branch_id')::uuid;
  v_opid       uuid := (p_payload->>'client_op_id')::uuid;
  v_cached     jsonb;
  v_receipt    uuid;
  v_line       jsonb;
  v_batch      uuid;
  v_total      numeric(14,3) := 0;
  v_count      int := 0;
  v_qty        numeric(12,3);
  v_cost       numeric(12,3);
begin
  -- tenant من الفرع (مصدر الحقيقة — لا نثق بمدخل العميل)
  select tenant_id into v_tenant from branches where id = v_branch;
  if v_tenant is null then
    raise exception 'AURAN_BAD_BRANCH';
  end if;

  perform _guard(v_tenant, array['owner','manager','staff']::user_role[]);

  -- idempotency
  if v_opid is not null then
    select result into v_cached from processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;

  insert into goods_receipts(tenant_id, branch_id, supplier_id, reference, created_by)
  values (v_tenant, v_branch, nullif(p_payload->>'supplier_id','')::uuid,
          p_payload->>'reference', auth.uid())
  returning id into v_receipt;

  for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
    v_qty  := (v_line->>'quantity')::numeric;
    v_cost := coalesce((v_line->>'cost_price')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'AURAN_BAD_QTY';
    end if;

    insert into stock_batches(tenant_id, branch_id, product_id, quantity, cost_price, expiry_date, received_at)
    values (v_tenant, v_branch, (v_line->>'product_id')::uuid, v_qty, v_cost,
            nullif(v_line->>'expiry_date','')::date, now())
    returning id into v_batch;

    insert into goods_receipt_items(receipt_id, product_id, quantity, cost_price, expiry_date, batch_id)
    values (v_receipt, (v_line->>'product_id')::uuid, v_qty, v_cost,
            nullif(v_line->>'expiry_date','')::date, v_batch);

    insert into stock_movements(tenant_id, branch_id, product_id, batch_id, type, quantity, reference_id, created_by)
    values (v_tenant, v_branch, (v_line->>'product_id')::uuid, v_batch, 'receipt', v_qty, v_receipt, auth.uid());

    v_total := v_total + (v_qty * v_cost);
    v_count := v_count + 1;
  end loop;

  update goods_receipts set total_cost = v_total where id = v_receipt;

  declare v_result jsonb := jsonb_build_object('receipt_id', v_receipt, 'batches', v_count, 'total_cost', v_total);
  begin
    if v_opid is not null then
      insert into processed_ops(client_op_id, tenant_id, user_id, op_type, result)
      values (v_opid, v_tenant, auth.uid(), 'receive_goods', v_result);
    end if;
    return v_result;
  end;
end; $$;

-- ===========================================================================
-- 2) record_damage — تسجيل تالف (يخصم FEFO + حركات خروج)  [PHASE 07]
-- p_payload:
-- {
--   "client_op_id":"uuid", "branch_id":"uuid", "product_id":"uuid",
--   "quantity":3.000, "reason":"expired|broken|spoiled|other", "note":"text|null"
-- }
-- يعيد: { "damaged": [ {batch_id, qty}... ], "total": x }
-- يفشل كلياً إن كان المخزون غير كافٍ (لا خصم جزئي).
-- ===========================================================================
create or replace function record_damage(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_branch uuid := (p_payload->>'branch_id')::uuid;
  v_prod   uuid := (p_payload->>'product_id')::uuid;
  v_opid   uuid := (p_payload->>'client_op_id')::uuid;
  v_cached jsonb;
  v_need   numeric(12,3) := (p_payload->>'quantity')::numeric;
  v_reason damage_reason := coalesce((p_payload->>'reason')::damage_reason, 'other');
  v_take   numeric(12,3);
  v_batch  record;
  v_allocs jsonb := '[]'::jsonb;
  v_done   numeric(12,3) := 0;
begin
  select tenant_id into v_tenant from branches where id = v_branch;
  if v_tenant is null then raise exception 'AURAN_BAD_BRANCH'; end if;
  perform _guard(v_tenant, array['owner','manager','staff']::user_role[]);

  if v_need is null or v_need <= 0 then raise exception 'AURAN_BAD_QTY'; end if;

  if v_opid is not null then
    select result into v_cached from processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;

  -- تحقّق توفّر الكمية الكلية أولاً (لتفادي خصم جزئي)
  if (select coalesce(sum(quantity),0) from stock_batches
        where tenant_id=v_tenant and branch_id=v_branch and product_id=v_prod and quantity>0) < v_need then
    raise exception 'AURAN_INSUFFICIENT_STOCK';
  end if;

  -- خصم FEFO: الأقرب انتهاءً أولاً، ثم الأقدم استلاماً  (مطابق fefo.ts)
  for v_batch in
    select id, quantity from stock_batches
    where tenant_id=v_tenant and branch_id=v_branch and product_id=v_prod and quantity>0
    order by expiry_date asc nulls last, received_at asc
    for update
  loop
    exit when v_done >= v_need;
    v_take := least(v_batch.quantity, v_need - v_done);

    update stock_batches set quantity = quantity - v_take where id = v_batch.id;

    insert into damaged_products(tenant_id, branch_id, product_id, batch_id, quantity, reason, note, created_by)
    values (v_tenant, v_branch, v_prod, v_batch.id, v_take, v_reason, p_payload->>'note', auth.uid());

    insert into stock_movements(tenant_id, branch_id, product_id, batch_id, type, quantity, created_by)
    values (v_tenant, v_branch, v_prod, v_batch.id, 'damage', -v_take, auth.uid());

    v_allocs := v_allocs || jsonb_build_object('batch_id', v_batch.id, 'qty', v_take);
    v_done := v_done + v_take;
  end loop;

  declare v_result jsonb := jsonb_build_object('damaged', v_allocs, 'total', v_done);
  begin
    if v_opid is not null then
      insert into processed_ops(client_op_id, tenant_id, user_id, op_type, result)
      values (v_opid, v_tenant, auth.uid(), 'record_damage', v_result);
    end if;
    return v_result;
  end;
end; $$;

-- ===========================================================================
-- 3) close_count — إغلاق جرد + تسوية المخزون (FEFO للعجز)  [PHASE 08]
-- p_payload: { "client_op_id":"uuid", "count_id":"uuid" }
-- يعيد ملخص الفروقات.
-- ===========================================================================
create or replace function close_count(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count  uuid := (p_payload->>'count_id')::uuid;
  v_opid   uuid := (p_payload->>'client_op_id')::uuid;
  v_tenant uuid; v_branch uuid; v_cached jsonb;
  v_item   record; v_diff numeric(12,3); v_need numeric(12,3);
  v_batch  record; v_take numeric(12,3); v_done numeric(12,3);
  v_newbatch uuid; v_diffs jsonb := '[]'::jsonb;
begin
  select tenant_id, branch_id into v_tenant, v_branch from inventory_counts where id = v_count;
  if v_tenant is null then raise exception 'AURAN_BAD_COUNT'; end if;
  perform _guard(v_tenant, array['owner','manager','staff']::user_role[]);

  if (select status from inventory_counts where id=v_count) = 'closed' then
    raise exception 'AURAN_COUNT_CLOSED';
  end if;

  if v_opid is not null then
    select result into v_cached from processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;

  for v_item in
    select product_id, expected_qty, counted_qty from inventory_count_items where count_id = v_count
  loop
    v_diff := v_item.counted_qty - v_item.expected_qty;
    if v_diff = 0 then continue; end if;

    if v_diff < 0 then
      -- عجز: اخصم بـ FEFO
      v_need := -v_diff; v_done := 0;
      for v_batch in
        select id, quantity from stock_batches
        where tenant_id=v_tenant and branch_id=v_branch and product_id=v_item.product_id and quantity>0
        order by expiry_date asc nulls last, received_at asc
        for update
      loop
        exit when v_done >= v_need;
        v_take := least(v_batch.quantity, v_need - v_done);
        update stock_batches set quantity = quantity - v_take where id = v_batch.id;
        v_done := v_done + v_take;
      end loop;
    else
      -- زيادة: أضِف إلى أحدث دفعة، أو أنشئ دفعة تسوية بلا انتهاء
      select id into v_newbatch from stock_batches
        where tenant_id=v_tenant and branch_id=v_branch and product_id=v_item.product_id
        order by received_at desc limit 1;
      if v_newbatch is null then
        insert into stock_batches(tenant_id, branch_id, product_id, quantity, cost_price, expiry_date)
        values (v_tenant, v_branch, v_item.product_id, v_diff, 0, null)
        returning id into v_newbatch;
      else
        update stock_batches set quantity = quantity + v_diff where id = v_newbatch;
      end if;
    end if;

    insert into stock_movements(tenant_id, branch_id, product_id, type, quantity, reference_id, created_by)
    values (v_tenant, v_branch, v_item.product_id, 'adjustment', v_diff, v_count, auth.uid());

    v_diffs := v_diffs || jsonb_build_object(
      'product_id', v_item.product_id, 'expected', v_item.expected_qty,
      'counted', v_item.counted_qty, 'diff', v_diff);
  end loop;

  update inventory_counts set status='closed', closed_at=now() where id = v_count;

  declare v_result jsonb := jsonb_build_object('count_id', v_count, 'differences', v_diffs);
  begin
    if v_opid is not null then
      insert into processed_ops(client_op_id, tenant_id, user_id, op_type, result)
      values (v_opid, v_tenant, auth.uid(), 'close_count', v_result);
    end if;
    return v_result;
  end;
end; $$;

-- ===========================================================================
-- 4) apply_pos_import — تطبيق استيراد مبيعات (خصم FEFO للمطابَق)  [PHASE 09]
-- p_payload:
-- {
--   "client_op_id":"uuid", "branch_id":"uuid", "source":"POS2",
--   "file_name":"...", "rows": [
--     { "product_id":"uuid|null", "barcode":"...", "quantity":2.0,
--       "total":21.00, "sold_at":"2026-05-20T14:00:00Z" }
--   ]
-- }
-- يعيد: { import_id, matched, unmatched, deducted }
-- الصفوف غير المطابقة تُسجَّل بلا خصم (للمراجعة).
-- ===========================================================================
create or replace function apply_pos_import(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid; v_branch uuid := (p_payload->>'branch_id')::uuid;
  v_opid uuid := (p_payload->>'client_op_id')::uuid; v_cached jsonb;
  v_import uuid; v_row jsonb; v_prod uuid; v_qty numeric(12,3);
  v_matched int := 0; v_unmatched int := 0; v_deducted numeric(14,3) := 0;
  v_need numeric(12,3); v_done numeric(12,3); v_take numeric(12,3); v_batch record;
begin
  select tenant_id into v_tenant from branches where id = v_branch;
  if v_tenant is null then raise exception 'AURAN_BAD_BRANCH'; end if;
  perform _guard(v_tenant, array['owner','manager']::user_role[]);

  if v_opid is not null then
    select result into v_cached from processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;

  insert into pos_imports(tenant_id, branch_id, source, file_name, rows_count, created_by)
  values (v_tenant, v_branch, coalesce(p_payload->>'source','POS2'), p_payload->>'file_name',
          jsonb_array_length(p_payload->'rows'), auth.uid())
  returning id into v_import;

  for v_row in select * from jsonb_array_elements(p_payload->'rows') loop
    v_qty := (v_row->>'quantity')::numeric;
    v_prod := nullif(v_row->>'product_id','')::uuid;

    -- مطابقة بالباركود إن لم يُمرّر product_id
    if v_prod is null and (v_row->>'barcode') is not null then
      select id into v_prod from products
        where tenant_id=v_tenant and barcode = v_row->>'barcode' limit 1;
    end if;

    insert into pos_import_items(import_id, product_id, barcode, quantity, sold_at, total)
    values (v_import, v_prod, v_row->>'barcode', v_qty,
            nullif(v_row->>'sold_at','')::timestamptz, coalesce((v_row->>'total')::numeric,0));

    if v_prod is null then
      v_unmatched := v_unmatched + 1;
      continue;  -- لا خصم لغير المطابَق
    end if;

    v_matched := v_matched + 1;

    -- خصم FEFO بقدر المتاح (البيع قد يتجاوز المخزون المسجّل — نخصم المتاح فقط)
    v_need := v_qty; v_done := 0;
    for v_batch in
      select id, quantity from stock_batches
      where tenant_id=v_tenant and branch_id=v_branch and product_id=v_prod and quantity>0
      order by expiry_date asc nulls last, received_at asc
      for update
    loop
      exit when v_done >= v_need;
      v_take := least(v_batch.quantity, v_need - v_done);
      update stock_batches set quantity = quantity - v_take where id = v_batch.id;
      insert into stock_movements(tenant_id, branch_id, product_id, batch_id, type, quantity, reference_id, created_by)
      values (v_tenant, v_branch, v_prod, v_batch.id, 'sale', -v_take, v_import, auth.uid());
      v_done := v_done + v_take;
    end loop;
    v_deducted := v_deducted + v_done;
  end loop;

  declare v_result jsonb := jsonb_build_object(
    'import_id', v_import, 'matched', v_matched,
    'unmatched', v_unmatched, 'deducted', v_deducted);
  begin
    if v_opid is not null then
      insert into processed_ops(client_op_id, tenant_id, user_id, op_type, result)
      values (v_opid, v_tenant, auth.uid(), 'apply_pos_import', v_result);
    end if;
    return v_result;
  end;
end; $$;

-- ===========================================================================
-- صلاحيات التنفيذ
-- ===========================================================================
grant execute on function receive_goods(jsonb)    to authenticated;
grant execute on function record_damage(jsonb)    to authenticated;
grant execute on function close_count(jsonb)       to authenticated;
grant execute on function apply_pos_import(jsonb)  to authenticated;
