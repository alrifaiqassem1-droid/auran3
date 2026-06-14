-- 0014_webhook_core.sql
-- Webhook integration — PHASE 2: shared FEFO deduction core.
create or replace function _apply_pos_import_core(
  p_tenant uuid, p_branch uuid, p_payload jsonb, p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_import uuid; v_row jsonb; v_prod uuid; v_qty numeric(12,3);
  v_matched int := 0; v_unmatched int := 0; v_deducted numeric(14,3) := 0;
  v_need numeric(12,3); v_done numeric(12,3); v_take numeric(12,3); v_batch record;
begin
  insert into pos_imports(tenant_id, branch_id, source, file_name, rows_count, created_by)
  values (p_tenant, p_branch, coalesce(p_payload->>'source','POS2'), p_payload->>'file_name',
          jsonb_array_length(p_payload->'rows'), p_actor)
  returning id into v_import;
  for v_row in select * from jsonb_array_elements(p_payload->'rows') loop
    v_qty := (v_row->>'quantity')::numeric;
    v_prod := nullif(v_row->>'product_id','')::uuid;
    if v_prod is null and (v_row->>'barcode') is not null then
      select id into v_prod from products
        where tenant_id=p_tenant and barcode = v_row->>'barcode' limit 1;
    end if;
    insert into pos_import_items(import_id, product_id, barcode, quantity, sold_at, total)
    values (v_import, v_prod, v_row->>'barcode', v_qty,
            nullif(v_row->>'sold_at','')::timestamptz, coalesce((v_row->>'total')::numeric,0));
    if v_prod is null then v_unmatched := v_unmatched + 1; continue; end if;
    v_matched := v_matched + 1;
    v_need := v_qty; v_done := 0;
    for v_batch in
      select id, quantity from stock_batches
      where tenant_id=p_tenant and branch_id=p_branch and product_id=v_prod and quantity>0
      order by expiry_date asc nulls last, received_at asc
      for update
    loop
      exit when v_done >= v_need;
      v_take := least(v_batch.quantity, v_need - v_done);
      update stock_batches set quantity = quantity - v_take where id = v_batch.id;
      insert into stock_movements(tenant_id, branch_id, product_id, batch_id, type, quantity, reference_id, created_by)
      values (p_tenant, p_branch, v_prod, v_batch.id, 'sale', -v_take, v_import, p_actor);
      v_done := v_done + v_take;
    end loop;
    v_deducted := v_deducted + v_done;
  end loop;
  return jsonb_build_object('import_id', v_import, 'matched', v_matched,
    'unmatched', v_unmatched, 'deducted', v_deducted);
end; $$;

create or replace function apply_pos_import(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_tenant uuid; v_branch uuid := (p_payload->>'branch_id')::uuid;
  v_opid uuid := (p_payload->>'client_op_id')::uuid; v_cached jsonb; v_result jsonb;
begin
  select tenant_id into v_tenant from branches where id = v_branch;
  if v_tenant is null then raise exception 'AURAN_BAD_BRANCH'; end if;
  perform _guard(v_tenant, array['owner','manager']::user_role[]);
  if v_opid is not null then
    select result into v_cached from processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;
  v_result := _apply_pos_import_core(v_tenant, v_branch, p_payload, auth.uid());
  if v_opid is not null then
    insert into processed_ops(client_op_id, tenant_id, user_id, op_type, result)
    values (v_opid, v_tenant, auth.uid(), 'apply_pos_import', v_result);
  end if;
  return v_result;
end; $$;

create or replace function webhook_pos_import(p_secret text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ep record; v_opid uuid := (p_payload->>'client_op_id')::uuid;
  v_cached jsonb; v_result jsonb;
begin
  if p_secret is null then raise exception 'AURAN_NO_SECRET'; end if;
  select * into v_ep from webhook_endpoints
   where secret_hash = encode(digest(p_secret,'sha256'),'hex') and is_active = true
   limit 1;
  if v_ep is null then raise exception 'AURAN_BAD_SECRET'; end if;
  if v_opid is not null then
    select result into v_cached from processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;
  v_result := _apply_pos_import_core(v_ep.tenant_id, v_ep.branch_id, p_payload, null);
  if v_opid is not null then
    insert into processed_ops(client_op_id, tenant_id, user_id, op_type, result)
    values (v_opid, v_ep.tenant_id, null, 'webhook_pos_import', v_result);
  end if;
  update webhook_endpoints set last_used_at = now() where id = v_ep.id;
  return v_result;
end; $$;
