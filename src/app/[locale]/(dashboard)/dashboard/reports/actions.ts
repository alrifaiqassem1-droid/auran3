'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { roundMoney } from '@/lib/pricing';
import { expiryStatus } from '@/lib/stock/fefo';

// ─── Tenant Info ─────────────────────────────────────────────────────────────

export interface TenantInfo {
  name: string;
  trn: string | null;
  vat_rate: number;
}

export async function getTenantInfo(): Promise<TenantInfo | null> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return null;

  const { data } = await supabase
    .from('tenants')
    .select('name, trn, vat_rate')
    .eq('id', tenantId)
    .single();
  return data as TenantInfo | null;
}

// ─── VAT Report ──────────────────────────────────────────────────────────────

export interface VatLine {
  date: string;
  gross: number;
  net: number;
  vat: number;
  transactions: number;
}

export interface VatReport {
  lines: VatLine[];
  totals: { gross: number; net: number; vat: number; transactions: number };
  period: { from: string; to: string };
}

export async function getVatReport(
  branchId: string,
  from: string,
  to: string,
): Promise<VatReport> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return { lines: [], totals: { gross: 0, net: 0, vat: 0, transactions: 0 }, period: { from, to } };

  const { data: items } = await supabase
    .from('pos_import_items')
    .select('quantity, total, sold_at, pos_imports!inner(branch_id, created_at)')
    .eq('pos_imports.branch_id', branchId)
    .eq('pos_imports.tenant_id', tenantId)
    .gte('pos_imports.created_at', from)
    .lte('pos_imports.created_at', to)
    .not('total', 'eq', 0);

  const rows = (items ?? []) as Array<{
    quantity: number;
    total: number;
    sold_at: string | null;
    pos_imports: { branch_id: string; created_at: string };
  }>;

  // Group by date
  const byDate = new Map<string, VatLine>();
  for (const row of rows) {
    const date = (row.sold_at ?? row.pos_imports.created_at).slice(0, 10);
    const gross = roundMoney(Number(row.total));
    const net   = roundMoney(gross / 1.05);
    const vat   = roundMoney(gross - net);

    const existing = byDate.get(date) ?? { date, gross: 0, net: 0, vat: 0, transactions: 0 };
    byDate.set(date, {
      date,
      gross:        roundMoney(existing.gross + gross),
      net:          roundMoney(existing.net + net),
      vat:          roundMoney(existing.vat + vat),
      transactions: existing.transactions + 1,
    });
  }

  const lines = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const totals = lines.reduce(
    (acc, l) => ({
      gross:        roundMoney(acc.gross + l.gross),
      net:          roundMoney(acc.net + l.net),
      vat:          roundMoney(acc.vat + l.vat),
      transactions: acc.transactions + l.transactions,
    }),
    { gross: 0, net: 0, vat: 0, transactions: 0 },
  );

  return { lines, totals, period: { from, to } };
}

// ─── Damage Report ────────────────────────────────────────────────────────────

export interface DamageMonth {
  month: string;    // "2026-05"
  label: string;   // "May 26"
  loss_value: number;
  total_qty: number;
  count: number;
}

export interface DamageReport {
  months: DamageMonth[];
  total_loss: number;
  total_qty: number;
}

export async function getDamageReport(branchId: string, monthsBack = 6): Promise<DamageReport> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return { months: [], total_loss: 0, total_qty: 0 };

  const from = new Date();
  from.setMonth(from.getMonth() - monthsBack + 1);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('damaged_products')
    .select('quantity, created_at, stock_batches(cost_price)')
    .eq('branch_id', branchId)
    .eq('tenant_id', tenantId)
    .gte('created_at', from.toISOString())
    .order('created_at');

  type DmgRow = {
    quantity: number;
    created_at: string;
    stock_batches: { cost_price: number } | null;
  };

  const rows = (data ?? []) as DmgRow[];

  const byMonth = new Map<string, DamageMonth>();

  for (const row of rows) {
    const d = new Date(row.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'Asia/Dubai' });
    const cost = Number(row.stock_batches?.cost_price ?? 0);
    const qty  = Number(row.quantity);
    const loss = roundMoney(qty * cost);

    const ex = byMonth.get(key) ?? { month: key, label, loss_value: 0, total_qty: 0, count: 0 };
    byMonth.set(key, {
      month: key, label,
      loss_value: roundMoney(ex.loss_value + loss),
      total_qty:  Math.round((ex.total_qty + qty) * 1000) / 1000,
      count:      ex.count + 1,
    });
  }

  const months = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
  const total_loss = roundMoney(months.reduce((s, m) => s + m.loss_value, 0));
  const total_qty  = Math.round(months.reduce((s, m) => s + m.total_qty, 0) * 1000) / 1000;

  return { months, total_loss, total_qty };
}

// ─── Expiry Tracker ───────────────────────────────────────────────────────────

export interface ExpiryBatch {
  id: string;
  product_id: string;
  product_name: string;
  product_unit: string;
  quantity: number;
  expiry_date: string | null;
  days_left: number | null;
  status: 'expired' | 'critical' | 'warning' | 'safe' | 'none';
}

export interface ExpiryData {
  expired:  ExpiryBatch[];
  critical: ExpiryBatch[];
  warning:  ExpiryBatch[];
  safe:     ExpiryBatch[];
}

export async function getExpiryData(branchId: string): Promise<ExpiryData> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return { expired: [], critical: [], warning: [], safe: [] };

  const { data } = await supabase
    .from('stock_batches')
    .select('id, product_id, quantity, expiry_date, products(name, unit)')
    .eq('branch_id', branchId)
    .eq('tenant_id', tenantId)
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true, nullsFirst: false });

  type BatchRow = {
    id: string;
    product_id: string;
    quantity: number;
    expiry_date: string | null;
    products: { name: string; unit: string } | null;
  };

  const today = new Date();
  const rows = (data ?? []) as BatchRow[];

  const result: ExpiryData = { expired: [], critical: [], warning: [], safe: [] };

  for (const row of rows) {
    const status = expiryStatus(row.expiry_date, 7, 30, today);
    const daysLeft = row.expiry_date
      ? Math.floor((new Date(row.expiry_date + 'T00:00:00').getTime() - today.getTime()) / 86_400_000)
      : null;

    const batch: ExpiryBatch = {
      id: row.id,
      product_id: row.product_id,
      product_name: row.products?.name ?? '—',
      product_unit: row.products?.unit ?? 'pcs',
      quantity: Number(row.quantity),
      expiry_date: row.expiry_date,
      days_left: daysLeft,
      status,
    };

    if (status === 'expired') result.expired.push(batch);
    else if (status === 'critical') result.critical.push(batch);
    else if (status === 'warning') result.warning.push(batch);
    else result.safe.push(batch);
  }

  return result;
}
