'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { AlertTriangle, TrendingDown, Truck, Skull, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import type { DashboardKPIs } from './actions';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

/* Bento order: Row 1 = two small square cards, Row 2 = wide + medium */
const KPI_STYLES = [
  { key: 'lowStock',      icon: TrendingDown,  colorCls: 'text-rose-500',    bgCls: 'bg-rose-500/10',    href: '/dashboard/products'  },
  { key: 'expiringSoon',  icon: AlertTriangle, colorCls: 'text-amber-500',   bgCls: 'bg-amber-500/10',   href: '/dashboard/expiry'    },
  { key: 'monthDamage',   icon: Skull,         colorCls: 'text-orange-500',  bgCls: 'bg-orange-500/10',  href: '/dashboard/damaged'   },
  { key: 'todayReceipts', icon: Truck,         colorCls: 'text-emerald-500', bgCls: 'bg-emerald-500/10', href: '/dashboard/receiving' },
] as const;

/* Per-index bento col-span — mirrors BentoSkeletonCards exactly */
const CARD_GRID = [
  'col-span-1 aspect-square lg:col-span-2 lg:aspect-auto lg:min-h-[136px]',  // lowStock
  'col-span-1 aspect-square lg:col-span-2 lg:aspect-auto lg:min-h-[136px]',  // expiringSoon
  'col-span-2 min-h-[136px] lg:col-span-3',                                   // monthDamage
  'col-span-2 min-h-[136px] lg:col-span-1',                                   // todayReceipts
] as const;

export function KpiCards({ kpis }: { kpis: DashboardKPIs }) {
  const t       = useTranslations('Dashboard');
  const reduced = useReducedMotion();

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {KPI_STYLES.map((cfg, i) => {
        const Icon  = cfg.icon;
        const value = kpis[cfg.key];
        return (
          <motion.div
            key={cfg.key}
            className={CARD_GRID[i]}
            initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay:    reduced ? 0 : i * 0.07,
              duration: reduced ? 0 : 0.35,
              ease:     [0.22, 1, 0.36, 1],
            }}
          >
            <Link href={cfg.href} className="block h-full">
              <Card className="h-full border-border/50 overflow-hidden cursor-pointer transition-all hover:border-border hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${cfg.bgCls}`}>
                      <Icon className={`h-5 w-5 ${cfg.colorCls}`} />
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-3xl font-bold tracking-tight">{fmt(value)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                    {t(cfg.key)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
