# PHASE 03 — Database Schema + RLS (الأهم)

> الالتزام بـ `CONTEXT.md`. هذا الـ Schema هو العمود الفقري. نفّذه حرفياً.

## المهمة
أنشئ ملف الهجرة `supabase/migrations/0001_init.sql` بالمحتوى التالي بالكامل، ثم طبّقه على Supabase
(عبر SQL Editor في لوحة Supabase — انسخ/الصق ونفّذ، أو عبر Supabase CLI `supabase db push`).
ثم ولّد أنواع TypeScript إلى `src/types/database.types.ts`.

---

### === supabase/migrations/0001_init.sql ===
```sql
-- ============ AURAN SCHEMA v1 ============
create extension if not exists "uuid-ossp";

-- ---------- ENUMS ----------
create type user_role as enum ('owner','manager','staff');
create type product_unit as enum ('pcs','kg');
create type movement_type as enum ('receipt','sale','damage','adjustment','count');
create type damage_reason as enum ('expired','broken','spoiled','other');
create type notification_type as enum ('expiry_soon','low_stock','receipt','damage','count','system');

-- ---------- TENANTS / BRANCHES ----------
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  trn text,                                  -- Tax Registration Number (UAE)
  vat_rate numeric(5,2) not null default 5.00,
  created_at timestamptz not null default now()
);

create table branches (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  address text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on branches(tenant_id);

-- ---------- PROFILES (extends auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------- MEMBERSHIPS ----------
create table memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  role user_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);
create index on memberships(user_id);
create index on memberships(tenant_id);

-- ---------- CATEGORIES ----------
create table categories (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index on categories(tenant_id);

-- ---------- SUPPLIERS ----------
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);
create index on suppliers(tenant_id);

-- ---------- PRODUCTS ----------
create table products (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  barcode text,                              -- قد يكون فارغاً لمنتجات الوزن
  unit product_unit not null default 'pcs',
  cost_price numeric(12,3) not null default 0,
  sell_price numeric(12,3) not null default 0,
  vat_inclusive boolean not null default true,
  low_stock_threshold numeric(12,3) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, barcode)
);
create index on products(tenant_id);
create index on products(tenant_id, barcode);

-- ---------- STOCK BATCHES (FEFO core) ----------
create table stock_batches (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity numeric(12,3) not null default 0,    -- المتبقي
  cost_price numeric(12,3) not null default 0,
  expiry_date date,                             -- مفتاح FEFO
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on stock_batches(tenant_id, branch_id, product_id);
create index on stock_batches(expiry_date);
-- ترتيب FEFO: expiry_date ASC NULLS LAST

-- ---------- STOCK MOVEMENTS (ledger) ----------
create table stock_movements (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  batch_id uuid references stock_batches(id) on delete set null,
  type movement_type not null,
  quantity numeric(12,3) not null,              -- موجب=دخول، سالب=خروج
  reference_id uuid,                            -- ربط بمستند (receipt/damage/...)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on stock_movements(tenant_id, branch_id, product_id);
create index on stock_movements(created_at);

-- ---------- GOODS RECEIPTS ----------
create table goods_receipts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  reference text,
  total_cost numeric(14,3) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on goods_receipts(tenant_id, branch_id);

create table goods_receipt_items (
  id uuid primary key default uuid_generate_v4(),
  receipt_id uuid not null references goods_receipts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity numeric(12,3) not null,
  cost_price numeric(12,3) not null,
  expiry_date date,
  batch_id uuid references stock_batches(id) on delete set null
);
create index on goods_receipt_items(receipt_id);

-- ---------- DAMAGED PRODUCTS ----------
create table damaged_products (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  batch_id uuid references stock_batches(id) on delete set null,
  quantity numeric(12,3) not null,
  reason damage_reason not null default 'other',
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on damaged_products(tenant_id, branch_id);

-- ---------- INVENTORY COUNTS ----------
create table inventory_counts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  status text not null default 'open',          -- open | closed
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table inventory_count_items (
  id uuid primary key default uuid_generate_v4(),
  count_id uuid not null references inventory_counts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  expected_qty numeric(12,3) not null default 0,
  counted_qty numeric(12,3) not null default 0,
  created_at timestamptz not null default now()
);
create index on inventory_count_items(count_id);

-- ---------- POS SALES IMPORTS ----------
create table pos_imports (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  source text not null default 'POS2',
  file_name text,
  rows_count int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table pos_import_items (
  id uuid primary key default uuid_generate_v4(),
  import_id uuid not null references pos_imports(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  barcode text,
  quantity numeric(12,3) not null,
  sold_at timestamptz,
  total numeric(14,3) not null default 0
);
create index on pos_import_items(import_id);

-- ---------- NOTIFICATIONS ----------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid references branches(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,  -- المستهدف
  type notification_type not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications(user_id, is_read);

-- ============ HELPER: عضويات المستخدم الحالي ============
create or replace function auth_tenant_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from memberships where user_id = auth.uid();
$$;

create or replace function has_role(p_tenant uuid, p_roles user_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and tenant_id = p_tenant and role = any(p_roles)
  );
$$;

-- ============ RPC: bootstrap_tenant (يُستدعى عند التسجيل) ============
create or replace function bootstrap_tenant(p_company text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_branch uuid;
begin
  insert into tenants(name) values (p_company) returning id into v_tenant;
  insert into branches(tenant_id, name, is_default) values (v_tenant, 'Main', true) returning id into v_branch;
  insert into profiles(id, full_name) values (auth.uid(), p_full_name)
    on conflict (id) do update set full_name = excluded.full_name;
  insert into memberships(user_id, tenant_id, branch_id, role)
    values (auth.uid(), v_tenant, v_branch, 'owner');
  return v_tenant;
end; $$;

-- ============ ENABLE RLS ============
alter table tenants enable row level security;
alter table branches enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table products enable row level security;
alter table stock_batches enable row level security;
alter table stock_movements enable row level security;
alter table goods_receipts enable row level security;
alter table goods_receipt_items enable row level security;
alter table damaged_products enable row level security;
alter table inventory_counts enable row level security;
alter table inventory_count_items enable row level security;
alter table pos_imports enable row level security;
alter table pos_import_items enable row level security;
alter table notifications enable row level security;

-- ============ POLICIES ============
-- نمط عام: العضو في الـ tenant يرى/يعدّل بيانات الـ tenant.

-- tenants
create policy "tenant_select" on tenants for select using (id in (select auth_tenant_ids()));
create policy "tenant_update" on tenants for update using (has_role(id, array['owner']::user_role[]));

-- profiles (كل مستخدم يرى ويعدّل ملفه)
create policy "profile_self" on profiles for all using (id = auth.uid()) with check (id = auth.uid());

-- memberships
create policy "membership_select" on memberships for select using (tenant_id in (select auth_tenant_ids()));
create policy "membership_manage" on memberships for all
  using (has_role(tenant_id, array['owner']::user_role[]))
  with check (has_role(tenant_id, array['owner']::user_role[]));

-- دالة مولّدة لتطبيق نفس السياسة على جداول الـ tenant:
-- (طبّق الكتلة التالية على كل جدول تشغيلي)
-- SELECT للجميع داخل الـ tenant، INSERT/UPDATE/DELETE حسب الدور.

-- branches
create policy "branch_select" on branches for select using (tenant_id in (select auth_tenant_ids()));
create policy "branch_write"  on branches for all
  using (has_role(tenant_id, array['owner','manager']::user_role[]))
  with check (has_role(tenant_id, array['owner','manager']::user_role[]));

-- categories / suppliers / products (manager+ يكتب، الجميع يقرأ)
do $$
declare tbl text;
begin
  foreach tbl in array array['categories','suppliers','products'] loop
    execute format($f$
      create policy "%1$s_select" on %1$s for select using (tenant_id in (select auth_tenant_ids()));
      create policy "%1$s_write" on %1$s for all
        using (has_role(tenant_id, array['owner','manager']::user_role[]))
        with check (has_role(tenant_id, array['owner','manager']::user_role[]));
    $f$, tbl);
  end loop;
end $$;

-- العمليات اليومية: staff+ يكتب (يقرأ ويُدخل)، الحذف لـ manager+
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'stock_batches','stock_movements','goods_receipts',
    'damaged_products','inventory_counts','pos_imports'
  ] loop
    execute format($f$
      create policy "%1$s_select" on %1$s for select using (tenant_id in (select auth_tenant_ids()));
      create policy "%1$s_insert" on %1$s for insert with check (tenant_id in (select auth_tenant_ids()));
      create policy "%1$s_update" on %1$s for update using (tenant_id in (select auth_tenant_ids()));
      create policy "%1$s_delete" on %1$s for delete using (has_role(tenant_id, array['owner','manager']::user_role[]));
    $f$, tbl);
  end loop;
end $$;

-- جداول الأبناء (تتبع الأب عبر join). نسمح للأعضاء في نفس الـ tenant.
create policy "gri_all" on goods_receipt_items for all
  using (exists (select 1 from goods_receipts r where r.id = receipt_id and r.tenant_id in (select auth_tenant_ids())))
  with check (exists (select 1 from goods_receipts r where r.id = receipt_id and r.tenant_id in (select auth_tenant_ids())));

create policy "ici_all" on inventory_count_items for all
  using (exists (select 1 from inventory_counts c where c.id = count_id and c.tenant_id in (select auth_tenant_ids())))
  with check (exists (select 1 from inventory_counts c where c.id = count_id and c.tenant_id in (select auth_tenant_ids())));

create policy "pii_all" on pos_import_items for all
  using (exists (select 1 from pos_imports p where p.id = import_id and p.tenant_id in (select auth_tenant_ids())))
  with check (exists (select 1 from pos_imports p where p.id = import_id and p.tenant_id in (select auth_tenant_ids())));

-- notifications: المستخدم يرى إشعاراته فقط
create policy "notif_select" on notifications for select using (user_id = auth.uid() or (user_id is null and tenant_id in (select auth_tenant_ids())));
create policy "notif_update" on notifications for update using (user_id = auth.uid());
create policy "notif_insert" on notifications for insert with check (tenant_id in (select auth_tenant_ids()));
```

---

## توليد أنواع TypeScript
عبر Supabase CLI:
```bash
npx supabase login
npx supabase gen types typescript --project-id <PROJECT_REF> --schema public > src/types/database.types.ts
```
أو من SQL Editor → API Docs → نسخ الأنواع يدوياً. الهدف: ملف `src/types/database.types.ts` يحتوي نوع `Database`.

ثم أنشئ نوعاً مساعداً:
#### === src/types/db.ts ===
```ts
import type { Database } from './database.types';
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Product = Tables<'products'>;
export type StockBatch = Tables<'stock_batches'>;
export type Branch = Tables<'branches'>;
```

> حدّث عملاء Supabase ليكونوا مُنمّطين: `createBrowserClient<Database>(...)` و `createServerClient<Database>(...)`.

## التحقق
- تنفيذ الـ SQL بلا أخطاء على Supabase.
- إنشاء حساب جديد (PHASE 02) ثم استدعاء `bootstrap_tenant` ينشئ tenant + branch + membership(owner).
- محاولة قراءة بيانات tenant آخر ترجع صفراً (RLS تعمل).
- أكمل الآن `signUp` في PHASE 02 لاستدعاء `supabase.rpc('bootstrap_tenant', { p_company, p_full_name })`.
