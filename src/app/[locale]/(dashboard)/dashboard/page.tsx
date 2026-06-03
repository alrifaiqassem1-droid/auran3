import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { CelebrationEffect } from './celebration-effect';
import { KpiCards } from './kpi-cards';
import { getDashboardKPIs } from './actions';
import { BentoSkeletonCards } from '@/components/dashboard/bento-skeleton';

async function DashboardData() {
  const kpis = await getDashboardKPIs();
  return <KpiCards kpis={kpis} />;
}

export default async function DashboardHome() {
  const t = await getTranslations('Dashboard');

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <Suspense fallback={null}>
        <CelebrationEffect />
      </Suspense>

      {/* Header renders immediately — no Suspense, no layout shift */}
      <div className="mb-6">
        <p className="text-[11px] font-black tracking-[0.3em] text-muted-foreground mb-0.5">AURAN</p>
        <h1 className="text-2xl font-bold">{t('homeTitle')}</h1>
      </div>

      {/* KPI cards stream in; skeleton holds exact dimensions to prevent CLS */}
      <Suspense fallback={<BentoSkeletonCards />}>
        <DashboardData />
      </Suspense>
    </div>
  );
}
