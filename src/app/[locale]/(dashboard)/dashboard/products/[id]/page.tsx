import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, ArrowLeft, Package } from 'lucide-react';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BatchesTable } from '@/components/products/batches-table';
import { formatAED, priceBreakdown } from '@/lib/pricing';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id, locale } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase.from('products').select('name').eq('id', id).single();
  return { title: data?.name ?? 'Product' };
}

export default async function ProductDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'Products' });
  const supabase = await createServerClient();

  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) notFound();

  const { data: product } = await supabase
    .from('products')
    .select(`
      id, name, barcode, unit, category_id,
      categories(id, name, default_critical_days, default_warning_days),
      cost_price, sell_price, vat_inclusive,
      low_stock_threshold, is_active, created_at,
      expiry_critical_days, expiry_warning_days
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (!product) notFound();

  const { data: batches } = await supabase
    .from('stock_batches')
    .select('id, quantity, expiry_date, received_at, cost_price')
    .eq('product_id', id)
    .eq('tenant_id', tenantId)
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true, nullsFirst: false });

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('id, type, quantity, created_at')
    .eq('product_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50);

  const breakdown = priceBreakdown(product.sell_price, 5, product.vat_inclusive);
  const isRtl = locale === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  type CategoryData = { id: string; name: string; default_critical_days: number; default_warning_days: number };
  const categoryData = Array.isArray(product.categories)
    ? (product.categories[0] ?? null) as CategoryData | null
    : (product.categories as CategoryData | null);

  const effectiveCritical = product.expiry_critical_days ?? categoryData?.default_critical_days ?? 7;
  const effectiveWarning  = product.expiry_warning_days  ?? categoryData?.default_warning_days  ?? 30;

  return (
    <div className="container max-w-3xl py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/products"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <BackIcon className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{product.name}</h1>
            <Badge variant={product.unit === 'kg' ? 'secondary' : 'outline'} className="text-xs">
              {product.unit === 'kg' ? t('unitKg') : t('unitPcs')}
            </Badge>
            {!product.is_active && (
              <Badge variant="secondary" className="text-xs">{t('inactive')}</Badge>
            )}
          </div>
          {product.barcode && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{product.barcode}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="mb-4 w-full grid grid-cols-3">
          <TabsTrigger value="details">{t('tabDetails')}</TabsTrigger>
          <TabsTrigger value="batches">
            {t('tabBatches')}
            {batches && batches.length > 0 && (
              <span className="ms-1.5 rounded-full bg-primary/10 text-primary text-[10px] px-1.5">
                {batches.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="movements">{t('tabMovements')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <InfoRow label={t('category')} value={categoryData?.name ?? '—'} />
            <InfoRow label={t('sellPrice')} value={formatAED(product.sell_price)} mono />
            <InfoRow label={t('costPrice')} value={formatAED(product.cost_price)} mono />
            <div className="border-t border-border/50 pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t('vatBreakdown')}</p>
              <InfoRow label={t('net')} value={formatAED(breakdown.net)} mono />
              <InfoRow label={t('vat5')} value={formatAED(breakdown.vat)} mono accent="amber" />
              <InfoRow label={t('gross')} value={formatAED(breakdown.gross)} mono bold />
            </div>
            <div className="border-t border-border/50 pt-3">
              <InfoRow
                label={t('vatInclusive')}
                value={product.vat_inclusive ? t('yes') : t('no')}
              />
              <InfoRow
                label={t('lowStockThreshold')}
                value={String(product.low_stock_threshold)}
                mono
              />
            </div>
            <div className="border-t border-border/50 pt-3 space-y-1">
              <InfoRow
                label={t('expiryCriticalDays')}
                value={`${effectiveCritical}${product.expiry_critical_days == null ? ' ★' : ''}`}
                mono
              />
              <InfoRow
                label={t('expiryWarningDays')}
                value={`${effectiveWarning}${product.expiry_warning_days == null ? ' ★' : ''}`}
                mono
              />
              <p className="text-[11px] text-muted-foreground">★ {t('expiryThresholdDefault')}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="batches">
          <BatchesTable batches={batches ?? []} unit={product.unit as 'pcs' | 'kg'} />
        </TabsContent>

        <TabsContent value="movements">
          {!movements || movements.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {t('noMovements')}
            </div>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium capitalize">{t(`movement_${m.type}` as Parameters<typeof t>[0])}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {new Intl.DateTimeFormat('en-AE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          numberingSystem: 'latn',
                          timeZone: 'Asia/Dubai',
                        }).format(new Date(m.created_at))}
                      </p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm tabular-nums font-semibold ${
                    m.quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                  }`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  bold,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  accent?: 'amber';
}) {
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={[
          mono ? 'font-mono tabular-nums' : '',
          bold ? 'font-semibold' : '',
          accent === 'amber' ? 'text-amber-600 dark:text-amber-400' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
