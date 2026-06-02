'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';

export interface DashboardKPIs {
  expiringSoon:  number;   // distinct products with a batch expiring within 30 days
  lowStock:      number;   // products whose total stock < low_stock_threshold
  todayReceipts: number;   // goods_receipts created today (Dubai time)
  monthDamage:   number;   // total damaged quantity this month (Dubai time)
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];

  if (!tenantId) {
    return { expiringSoon: 0, lowStock: 0, todayReceipts: 0, monthDamage: 0 };
  }

  // ── Compute Dubai-local dates ────────────────────────────────────────────────
  const now = new Date();
  // Dubai = UTC+4
  const dubaiMs     = now.getTime() + 4 * 60 * 60 * 1000;
  const dubaiDate   = new Date(dubaiMs);
  const todayStr    = dubaiDate.toISOString().slice(0, 10);          // YYYY-MM-DD
  const monthStr    = todayStr.slice(0, 7);                          // YYYY-MM

  const todayStart  = new Date(`${todayStr}T00:00:00+04:00`);
  const monthStart  = new Date(`${monthStr}-01T00:00:00+04:00`);
  const plus30      = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
                        .toISOString().slice(0, 10);                 // expiry ceiling

  const [expSoon, lsCount, receipts, damage] = await Promise.allSettled([

    // 1 · Distinct products with a batch expiring ≤ 30 days (includes already expired)
    supabase
      .from('stock_batches')
      .select('product_id')
      .eq('tenant_id', tenantId)
      .gt('quantity', 0)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', plus30),

    // 2 · Products below their low_stock_threshold
    (async () => {
      const { data: prods } = await supabase
        .from('products')
        .select('id, low_stock_threshold')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .gt('low_stock_threshold', 0);

      if (!prods?.length) return 0;

      const pids = prods.map((p) => p.id);
      const { data: batches } = await supabase
        .from('stock_batches')
        .select('product_id, quantity')
        .eq('tenant_id', tenantId)
        .in('product_id', pids)
        .gt('quantity', 0);

      const stock = new Map<string, number>();
      for (const b of batches ?? []) {
        stock.set(b.product_id, (stock.get(b.product_id) ?? 0) + Number(b.quantity));
      }

      return prods.filter(
        (p) => (stock.get(p.id) ?? 0) < Number(p.low_stock_threshold),
      ).length;
    })(),

    // 3 · Goods receipts created today (Dubai midnight → UTC)
    supabase
      .from('goods_receipts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', todayStart.toISOString()),

    // 4 · Total damaged quantity this month
    supabase
      .from('damaged_products')
      .select('quantity')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart.toISOString()),
  ]);

  const expiringSoon = expSoon.status === 'fulfilled'
    ? new Set((expSoon.value.data ?? []).map((r) => r.product_id)).size
    : 0;

  const lowStock = lsCount.status === 'fulfilled' ? (lsCount.value as number) : 0;

  const todayReceipts = receipts.status === 'fulfilled'
    ? (receipts.value.count ?? 0)
    : 0;

  const monthDamage = damage.status === 'fulfilled'
    ? Math.round((damage.value.data ?? []).reduce((s, r) => s + Number(r.quantity), 0))
    : 0;

  return { expiringSoon, lowStock, todayReceipts, monthDamage };
}
