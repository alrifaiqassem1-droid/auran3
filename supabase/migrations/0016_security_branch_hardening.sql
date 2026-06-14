-- ============================================================================
-- 0016_security_branch_hardening.sql
-- AURAN Security Hardening — Branch Scoping + RLS Tightening
--
-- Applied live on 2026-06-14 via Supabase SQL Editor.
-- This file is for version control and reproducibility ONLY.
-- All statements are idempotent (CREATE OR REPLACE / DROP IF EXISTS).
-- ============================================================================


-- ── 1. auth_branch_ids() ─────────────────────────────────────────────────────
-- Returns the set of branch IDs accessible to the current user:
--   owners/managers → all branches in the tenant
--   staff            → only their scoped branch (memberships.branch_id)
-- Mirrors the TypeScript logic in src/lib/auth/branch-context.ts.
create or replace function public.auth_branch_ids()
returns uuid[]
language plpgsql security definer set search_path = public
as $$
begin
  return array(
    select distinct b.id
    from   public.branches   b
    join   public.memberships m on m.tenant_id = b.tenant_id
    where  m.user_id = auth.uid()
      and  (
             m.role in ('owner', 'manager')   -- full-access roles see all branches
             or m.branch_id = b.id            -- staff are scoped to one branch
           )
  );
end;
$$;

grant execute on function public.auth_branch_ids() to authenticated;


-- ── 2. _guard_branch() ───────────────────────────────────────────────────────
-- Raises AURAN_FORBIDDEN (42501) if the current user is not allowed to access
-- p_branch. Called inside write RPCs after _guard() to add branch-scope
-- enforcement on top of the tenant/role check.
create or replace function public._guard_branch(p_branch uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not (p_branch = any(public.auth_branch_ids())) then
    raise exception 'AURAN_FORBIDDEN: branch not in scope'
      using errcode = '42501';
  end if;
end;
$$;

grant execute on function public._guard_branch(uuid) to authenticated;


-- ── 3. Branch-scoped SELECT RLS on 6 operational tables ──────────────────────
-- Original policies (from 0001_init.sql) checked tenant_id only.
-- New policies additionally restrict rows to auth_branch_ids().
-- Policy names follow the pattern "{table}_select" established in 0001.

drop policy if exists "stock_batches_select"   on public.stock_batches;
create policy "stock_batches_select" on public.stock_batches
  for select using (
    tenant_id in (select public.auth_tenant_ids())
    and branch_id = any(public.auth_branch_ids())
  );

drop policy if exists "stock_movements_select" on public.stock_movements;
create policy "stock_movements_select" on public.stock_movements
  for select using (
    tenant_id in (select public.auth_tenant_ids())
    and branch_id = any(public.auth_branch_ids())
  );

drop policy if exists "goods_receipts_select"  on public.goods_receipts;
create policy "goods_receipts_select" on public.goods_receipts
  for select using (
    tenant_id in (select public.auth_tenant_ids())
    and branch_id = any(public.auth_branch_ids())
  );

drop policy if exists "damaged_products_select" on public.damaged_products;
create policy "damaged_products_select" on public.damaged_products
  for select using (
    tenant_id in (select public.auth_tenant_ids())
    and branch_id = any(public.auth_branch_ids())
  );

drop policy if exists "inventory_counts_select" on public.inventory_counts;
create policy "inventory_counts_select" on public.inventory_counts
  for select using (
    tenant_id in (select public.auth_tenant_ids())
    and branch_id = any(public.auth_branch_ids())
  );

drop policy if exists "pos_imports_select"     on public.pos_imports;
create policy "pos_imports_select" on public.pos_imports
  for select using (
    tenant_id in (select public.auth_tenant_ids())
    and branch_id = any(public.auth_branch_ids())
  );


-- ── 4. Write RPCs: add _guard_branch() call ──────────────────────────────────
-- Full replacements of the 4 atomic write RPCs from 0010_core_rpcs.sql
-- (and apply_pos_import from 0014_webhook_core.sql).
-- Only change vs the 0010/0014 originals: perform _guard_branch(v_branch)
-- is called immediately after perform _guard(...).

-- 4a. receive_goods ──────────────────────────────────────────────────────────
create or replace function public.receive_goods(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant  uuid;
  v_branch  uuid := (p_payload->>'branch_id')::uuid;
  v_opid    uuid := (p_payload->>'client_op_id')::uuid;
  v_cached  jsonb;
  v_receipt uuid;
  v_line    jsonb;
  v_batch   uuid;
  v_total   numeric(14,3) := 0;
  v_count   int := 0;
  v_qty     numeric(12,3);
  v_cost    numeric(12,3);
begin
  select tenant_id into v_tenant from public.branches where id = v_branch;
  if v_tenant is null then raise exception 'AURAN_BAD_BRANCH'; end if;

  perform public._guard(v_tenant, array['owner','manager','staff']::user_role[]);
  perform public._guard_branch(v_branch);

  if v_opid is not null then
    select result into v_cached from public.processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;

  insert into public.goods_receipts(tenant_id, branch_id, supplier_id, reference, created_by)
  values (v_tenant, v_branch, nullif(p_payload->>'supplier_id','')::uuid,
          p_payload->>'reference', auth.uid())
  returning id into v_receipt;

  for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
    v_qty  := (v_line->>'quantity')::numeric;
    v_cost := coalesce((v_line->>'cost_price')::numeric, 0);
    if v_qty is null or v_qty <= 0 then raise exception 'AURAN_BAD_QTY'; end if;

    insert into public.stock_batches(tenant_id, branch_id, product_id, quantity, cost_price, expiry_date, received_at)
    values (v_tenant, v_branch, (v_line->>'product_id')::uuid, v_qty, v_cost,
            nullif(v_line->>'expiry_date','')::date, now())
    returning id into v_batch;

    insert into public.goods_receipt_items(receipt_id, product_id, quantity, cost_price, expiry_date, batch_id)
    values (v_receipt, (v_line->>'product_id')::uuid, v_qty, v_cost,
            nullif(v_line->>'expiry_date','')::date, v_batch);

    insert into public.stock_movements(tenant_id, branch_id, product_id, batch_id, type, quantity, reference_id, created_by)
    values (v_tenant, v_branch, (v_line->>'product_id')::uuid, v_batch, 'receipt', v_qty, v_receipt, auth.uid());

    v_total := v_total + (v_qty * v_cost);
    v_count := v_count + 1;
  end loop;

  update public.goods_receipts set total_cost = v_total where id = v_receipt;

  declare v_result jsonb := jsonb_build_object('receipt_id', v_receipt, 'batches', v_count, 'total_cost', v_total);
  begin
    if v_opid is not null then
      insert into public.processed_ops(client_op_id, tenant_id, user_id, op_type, result)
      values (v_opid, v_tenant, auth.uid(), 'receive_goods', v_result);
    end if;
    return v_result;
  end;
end;
$$;

-- 4b. record_damage ──────────────────────────────────────────────────────────
create or replace function public.record_damage(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
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
  select tenant_id into v_tenant from public.branches where id = v_branch;
  if v_tenant is null then raise exception 'AURAN_BAD_BRANCH'; end if;

  perform public._guard(v_tenant, array['owner','manager','staff']::user_role[]);
  perform public._guard_branch(v_branch);

  if v_need is null or v_need <= 0 then raise exception 'AURAN_BAD_QTY'; end if;

  if v_opid is not null then
    select result into v_cached from public.processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;

  if (select coalesce(sum(quantity),0) from public.stock_batches
        where tenant_id=v_tenant and branch_id=v_branch
          and product_id=v_prod and quantity>0) < v_need then
    raise exception 'AURAN_INSUFFICIENT_STOCK';
  end if;

  for v_batch in
    select id, quantity from public.stock_batches
    where tenant_id=v_tenant and branch_id=v_branch and product_id=v_prod and quantity>0
    order by expiry_date asc nulls last, received_at asc
    for update
  loop
    exit when v_done >= v_need;
    v_take := least(v_batch.quantity, v_need - v_done);

    update public.stock_batches set quantity = quantity - v_take where id = v_batch.id;

    insert into public.damaged_products(tenant_id, branch_id, product_id, batch_id, quantity, reason, note, created_by)
    values (v_tenant, v_branch, v_prod, v_batch.id, v_take, v_reason, p_payload->>'note', auth.uid());

    insert into public.stock_movements(tenant_id, branch_id, product_id, batch_id, type, quantity, created_by)
    values (v_tenant, v_branch, v_prod, v_batch.id, 'damage', -v_take, auth.uid());

    v_allocs := v_allocs || jsonb_build_object('batch_id', v_batch.id, 'qty', v_take);
    v_done   := v_done + v_take;
  end loop;

  declare v_result jsonb := jsonb_build_object('damaged', v_allocs, 'total', v_done);
  begin
    if v_opid is not null then
      insert into public.processed_ops(client_op_id, tenant_id, user_id, op_type, result)
      values (v_opid, v_tenant, auth.uid(), 'record_damage', v_result);
    end if;
    return v_result;
  end;
end;
$$;

-- 4c. close_count ────────────────────────────────────────────────────────────
create or replace function public.close_count(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_count   uuid := (p_payload->>'count_id')::uuid;
  v_opid    uuid := (p_payload->>'client_op_id')::uuid;
  v_tenant  uuid; v_branch uuid; v_cached jsonb;
  v_item    record; v_diff numeric(12,3); v_need numeric(12,3);
  v_batch   record; v_take numeric(12,3); v_done numeric(12,3);
  v_newbatch uuid; v_diffs jsonb := '[]'::jsonb;
begin
  select tenant_id, branch_id into v_tenant, v_branch
  from   public.inventory_counts where id = v_count;
  if v_tenant is null then raise exception 'AURAN_BAD_COUNT'; end if;

  perform public._guard(v_tenant, array['owner','manager','staff']::user_role[]);
  perform public._guard_branch(v_branch);

  if (select status from public.inventory_counts where id = v_count) = 'closed' then
    raise exception 'AURAN_COUNT_CLOSED';
  end if;

  if v_opid is not null then
    select result into v_cached from public.processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;

  for v_item in
    select product_id, expected_qty, counted_qty
    from   public.inventory_count_items where count_id = v_count
  loop
    v_diff := v_item.counted_qty - v_item.expected_qty;
    if v_diff = 0 then continue; end if;

    if v_diff < 0 then
      v_need := -v_diff; v_done := 0;
      for v_batch in
        select id, quantity from public.stock_batches
        where tenant_id=v_tenant and branch_id=v_branch
          and product_id=v_item.product_id and quantity>0
        order by expiry_date asc nulls last, received_at asc
        for update
      loop
        exit when v_done >= v_need;
        v_take := least(v_batch.quantity, v_need - v_done);
        update public.stock_batches set quantity = quantity - v_take where id = v_batch.id;
        v_done := v_done + v_take;
      end loop;
    else
      select id into v_newbatch from public.stock_batches
        where tenant_id=v_tenant and branch_id=v_branch and product_id=v_item.product_id
        order by received_at desc limit 1;
      if v_newbatch is null then
        insert into public.stock_batches(tenant_id, branch_id, product_id, quantity, cost_price, expiry_date)
        values (v_tenant, v_branch, v_item.product_id, v_diff, 0, null)
        returning id into v_newbatch;
      else
        update public.stock_batches set quantity = quantity + v_diff where id = v_newbatch;
      end if;
    end if;

    insert into public.stock_movements(tenant_id, branch_id, product_id, type, quantity, reference_id, created_by)
    values (v_tenant, v_branch, v_item.product_id, 'adjustment', v_diff, v_count, auth.uid());

    v_diffs := v_diffs || jsonb_build_object(
      'product_id', v_item.product_id, 'expected', v_item.expected_qty,
      'counted', v_item.counted_qty, 'diff', v_diff);
  end loop;

  update public.inventory_counts set status='closed', closed_at=now() where id = v_count;

  declare v_result jsonb := jsonb_build_object('count_id', v_count, 'differences', v_diffs);
  begin
    if v_opid is not null then
      insert into public.processed_ops(client_op_id, tenant_id, user_id, op_type, result)
      values (v_opid, v_tenant, auth.uid(), 'close_count', v_result);
    end if;
    return v_result;
  end;
end;
$$;

-- 4d. apply_pos_import ───────────────────────────────────────────────────────
-- Thin wrapper rewritten in 0014 to call _apply_pos_import_core; adding
-- _guard_branch here for the authenticated (non-webhook) path.
create or replace function public.apply_pos_import(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_tenant uuid;
  v_branch uuid := (p_payload->>'branch_id')::uuid;
  v_opid   uuid := (p_payload->>'client_op_id')::uuid;
  v_cached jsonb;
  v_result jsonb;
begin
  select tenant_id into v_tenant from public.branches where id = v_branch;
  if v_tenant is null then raise exception 'AURAN_BAD_BRANCH'; end if;

  perform public._guard(v_tenant, array['owner','manager']::user_role[]);
  perform public._guard_branch(v_branch);

  if v_opid is not null then
    select result into v_cached from public.processed_ops where client_op_id = v_opid;
    if v_cached is not null then return v_cached; end if;
  end if;

  v_result := public._apply_pos_import_core(v_tenant, v_branch, p_payload, auth.uid());

  if v_opid is not null then
    insert into public.processed_ops(client_op_id, tenant_id, user_id, op_type, result)
    values (v_opid, v_tenant, auth.uid(), 'apply_pos_import', v_result);
  end if;

  return v_result;
end;
$$;

grant execute on function public.receive_goods(jsonb)    to authenticated;
grant execute on function public.record_damage(jsonb)    to authenticated;
grant execute on function public.close_count(jsonb)      to authenticated;
grant execute on function public.apply_pos_import(jsonb) to authenticated;


-- ── 5. Drop over-permissive INSERT policies on security tables ────────────────
-- app_insert_rla allowed anon + authenticated to INSERT directly into
-- rate_limit_attempts and auth_audit_log without going through the service_role.
-- rate-limit.ts and audit-log.ts already use the admin client (service_role),
-- which bypasses RLS, so these policies are not needed and widen attack surface.
drop policy if exists "app_insert_rla" on public.rate_limit_attempts;
drop policy if exists "app_insert_aal" on public.auth_audit_log;


-- ── 6. Invitations RLS tightening ────────────────────────────────────────────
-- Old (0007_roles.sql):
--   inv_token_select  → USING(true) — world-readable by anyone, even anon
--   inv_owner_all     → owner CRUD — but listed first; the world-read above negates it
-- New: split into two explicit policies with proper scope.

drop policy if exists "inv_token_select" on public.invitations;
drop policy if exists "inv_owner_all"    on public.invitations;

-- Owners manage invitations for their own tenant only.
create policy "invitations_owner_manage" on public.invitations
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role = 'owner'
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Invited user can read the invitation addressed to their email (for /join flow).
-- The token is a random UUID — already a secret; email filter adds explicit binding.
create policy "invitations_read_for_acceptance" on public.invitations
  for select
  using (
    email = lower((select email from auth.users where id = auth.uid()))
  );


-- ── 7. search_path hardening on trigger / seed functions ─────────────────────
-- 0008_hardening.sql set search_path on most functions but missed these four.
-- fn_auto_audit was set in 0008 but then lost when 0011 + 0012 re-created it
-- via CREATE OR REPLACE without SET search_path — this ALTER restores it.

alter function public.guard_last_owner_delete() set search_path = public, pg_temp;
alter function public.guard_last_owner_update() set search_path = public, pg_temp;
alter function public.seed_default_roles()      set search_path = public, pg_temp;
alter function public.fn_auto_audit()           set search_path = public, pg_temp;


-- ── 8. Earlier RLS fixes (first security session, 2026-06-14) ────────────────
-- These were applied via SQL Editor in the first part of tonight's session.
-- Documented here for completeness.

-- profiles: allow tenant members to read other members' display names
-- (needed by getRolesAndStaff() to populate the staff list via FK join).
-- The original "profile_self" FOR ALL policy remains and covers write ops.
drop policy if exists "profiles_team_select" on public.profiles;
create policy "profiles_team_select" on public.profiles
  for select
  using (
    id = auth.uid()
    or id in (
      select user_id from public.memberships
      where tenant_id in (select public.auth_tenant_ids())
    )
  );

-- notifications: the existing notif_select / notif_update / notif_insert policies
-- from 0001_init.sql already have correct scope (user_id = auth.uid() or broadcast
-- to tenant). No change needed — verified correct.

-- processed_ops: the "po_select" policy from 0010_core_rpcs.sql is tenant-scoped.
-- No change needed.


-- ── 9. Expiry threshold columns (already in 0015_expiry_thresholds.sql) ───────
-- Per-product and per-category expiry alert thresholds were added in migration
-- 0015_expiry_thresholds.sql. No additional SQL needed here.
-- See: categories.default_critical_days, categories.default_warning_days
--      products.expiry_critical_days, products.expiry_warning_days


-- ============================================================================
-- END OF MIGRATION 0016
-- ============================================================================
