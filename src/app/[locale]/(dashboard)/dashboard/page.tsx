import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { CelebrationEffect } from './celebration-effect';
import { KpiCards } from './kpi-cards';
import { getDashboardKPIs } from './actions';

export default async function DashboardHome() {
  const [t, kpis] = await Promise.all([
    getTranslations('Dashboard'),
    getDashboardKPIs(),
  ]);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Celebration fires when ?celebration=true is in URL */}
      <Suspense fallback={null}>
        <CelebrationEffect />
      </Suspense>

      <div className="mb-6">
        <p className="text-[11px] font-black tracking-[0.3em] text-muted-foreground mb-0.5">AURAN</p>
        <h1 className="text-2xl font-bold">{t('homeTitle')}</h1>
      </div>

      <KpiCards kpis={kpis} />
    </div>
  );
}
