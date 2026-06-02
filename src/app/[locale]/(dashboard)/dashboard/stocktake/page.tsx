'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { lookupProduct } from '@/lib/scan/lookup-product';
import { ScannerLayout, type ScannerProduct } from '@/components/scanner/scanner-layout';
import { StocktakeResultSheet } from '@/components/scanner/result-sheets/stocktake-result';
import type { Product } from '@/types/db';

type Result = { barcode: string; product: Product | null };

export default function StocktakePage() {
  const t                    = useTranslations('Stocktake');
  const router               = useRouter();
  const { activeMembership } = useActiveBranch();
  const tenantId             = activeMembership?.tenant_id;

  const [result, setResult] = useState<Result | null>(null);

  const handleScanned = useCallback(
    async (barcode: string) => {
      if (!tenantId) return;
      const product = await lookupProduct(barcode, tenantId);
      setResult({ barcode, product });
    },
    [tenantId],
  );

  function handleProductSelect(product: ScannerProduct) {
    setResult({ barcode: product.barcode ?? '', product: product as unknown as Product });
  }

  return (
    <>
      <ScannerLayout
        mode="stocktake"
        title={t('pageTitle')}
        onScanned={handleScanned}
        onProductSelect={handleProductSelect}
        onClose={() => router.push('/dashboard')}
      />
      <StocktakeResultSheet
        open={!!result}
        onClose={() => setResult(null)}
        barcode={result?.barcode ?? ''}
        product={result?.product ?? null}
      />
    </>
  );
}
