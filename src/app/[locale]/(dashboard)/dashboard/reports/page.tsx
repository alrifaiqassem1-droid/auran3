import { getTranslations } from 'next-intl/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getBranchContext } from '@/lib/auth/branch-context';
import { getMyBranches } from '../settings/branches/actions';
import { getTenantInfo, getVatReport, getDamageReport, getExpiryData } from './actions';
import { VatReport } from '@/components/reports/vat-report';
import { DamageReport } from '@/components/reports/damage-report';
import { ExpiryTracker } from '@/components/reports/expiry-tracker';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Reports' });
  return { title: t('pageTitle') };
}

export default async function ReportsPage() {
  const t = await getTranslations('Reports');
  const ctx = await getBranchContext();
  const branchId = ctx?.activeBranchId ?? null;

  if (!branchId) {
    return (
      <div className="container max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{t('noBranch')}</p>
      </div>
    );
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = new Date(y, m, 1).toISOString();
  const to   = new Date(y, m + 1, 0, 23, 59, 59).toISOString();

  const [tenant, vatData, damageData, expiryData, branches] = await Promise.all([
    getTenantInfo(),
    getVatReport(branchId, from, to),
    getDamageReport(branchId, 6),
    getExpiryData(branchId),
    getMyBranches(),
  ]);
  const branchName = branches.find(b => b.id === branchId)?.name ?? null;

  return (
    <div className="container max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <Tabs defaultValue="vat">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vat" className="text-xs sm:text-sm">{t('tabVat')}</TabsTrigger>
          <TabsTrigger value="damage" className="text-xs sm:text-sm">{t('tabDamage')}</TabsTrigger>
          <TabsTrigger value="expiry" className="text-xs sm:text-sm">{t('tabExpiry')}</TabsTrigger>
        </TabsList>

        <TabsContent value="vat" className="mt-5">
          <VatReport branchId={branchId} tenant={tenant} initialData={vatData} branchName={branchName} />
        </TabsContent>

        <TabsContent value="damage" className="mt-5">
          <DamageReport branchId={branchId} initialData={damageData} />
        </TabsContent>

        <TabsContent value="expiry" className="mt-5">
          <ExpiryTracker data={expiryData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
