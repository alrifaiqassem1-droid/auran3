-- 0013_webhook.sql
-- Webhook integration — STEP 1: endpoint registry + secret generation.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.webhook_endpoints (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id)  on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  label         text not null,
  secret_hash   text not null,
  secret_prefix text not null,
  is_active     boolean not null default true,
  last_used_at  timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now()
);

create index if not exists idx_webhook_endpoints_tenant on public.webhook_endpoints(tenant_id);
create index if not exists idx_webhook_endpoints_hash   on public.webhook_endpoints(secret_hash);

alter table public.webhook_endpoints enable row level security;

drop policy if exists webhook_endpoints_select on public.webhook_endpoints;
create policy webhook_endpoints_select
  on public.webhook_endpoints for select
  using (tenant_id in (select public.auth_tenant_ids()));

create or replace function public.generate_webhook_secret(p_branch uuid, p_label text)
returns table(endpoint_id uuid, secret text)
language plpgsql security definer set search_path = public, extensions
as $$
declare v_tenant uuid; v_secret text; v_id uuid;
begin
  select tenant_id into v_tenant from public.branches where id = p_branch;
  if v_tenant is null then raise exception 'branch_not_found'; end if;
  perform public._guard(v_tenant, array['owner','manager']::user_role[]);
  v_secret := 'whk_' || encode(gen_random_bytes(24), 'hex');
  insert into public.webhook_endpoints
    (tenant_id, branch_id, label, secret_hash, secret_prefix, created_by)
  values (v_tenant, p_branch, p_label,
          encode(digest(v_secret,'sha256'),'hex'), left(v_secret,12), auth.uid())
  returning id into v_id;
  return query select v_id, v_secret;
end; $$;

create or replace function public.revoke_webhook_endpoint(p_endpoint uuid)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.webhook_endpoints where id = p_endpoint;
  if v_tenant is null then raise exception 'endpoint_not_found'; end if;
  perform public._guard(v_tenant, array['owner','manager']::user_role[]);
  update public.webhook_endpoints set is_active = false where id = p_endpoint;
end; $$;
