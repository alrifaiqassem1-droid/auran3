'use client';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { PosImportWizard as WizardType } from './pos-import-wizard';

// papaparse (~30 kB) is loaded only when this client component mounts
const PosImportWizard = dynamic(
  () => import('./pos-import-wizard').then((m) => m.PosImportWizard),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    ),
  },
);

export function PosImportLazy(props: ComponentProps<typeof WizardType>) {
  return <PosImportWizard {...props} />;
}
