'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { lookupProduct } from '@/lib/scan/lookup-product';
import { createClient } from '@/lib/supabase/client';
import { ScannerLayout, type ScannerProduct } from '@/components/scanner/scanner-layout';
import { ScanResultSheet } from '@/components/scanner/result-sheets/scan-result';
import { ProductForm } from '@/components/products/product-form';
import type { Product } from '@/types/db';

type Result = { barcode: string; product: Product | null };

export default function ScanPage() {
  const t      = useTranslations('Scanner');
  const router = useRouter();
  const { activeMembership } = useActiveBranch();
  const tenantId = activeMembership?.tenant_id;

  const [result,         setResult]         = useState<Result | null>(null);
  const [showForm,       setShowForm]       = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [categories,     setCategories]     = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    createClient()
      .from('categories')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
      .then(({ data }) => setCategories((data ?? []) as { id: string; name: string }[]));
  }, [tenantId]);

  const handleScanned = useCallback(
    async (barcode: string) => {
      if (!tenantId) return;
      const product = await lookupProduct(barcode, tenantId);
      setResult({ barcode, product });
    },
    [tenantId],
  );

  function handleProductSelect(p: ScannerProduct) {
    setResult({ barcode: p.barcode ?? '', product: p as unknown as Product });
  }

  function handleAddProduct(barcode: string) {
    setPendingBarcode(barcode);
    setResult(null);
    setShowForm(true);
  }

  return (
    <>
      <ScannerLayout
        mode="scan"
        title={t('quickScan')}
        onScanned={handleScanned}
        onProductSelect={handleProductSelect}
        onClose={() => router.push('/dashboard')}
      />
      <ScanResultSheet
        open={!!result}
        onClose={() => setResult(null)}
        barcode={result?.barcode ?? ''}
        product={result?.product ?? null}
        onAddProduct={handleAddProduct}
      />
      <ProductForm
        open={showForm}
        onOpenChange={setShowForm}
        categories={categories}
        prefillBarcode={pendingBarcode ?? undefined}
        variant="sheet"
      />
    </>
  );
}
