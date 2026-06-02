'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { lookupProduct } from '@/lib/scan/lookup-product';
import { createClient } from '@/lib/supabase/client';
import { ScannerLayout, type ScannerProduct } from './scanner-layout';
import { ScanResultSheet } from './scan-result-sheet';
import { ProductForm } from '@/components/products/product-form';
import type { Product } from '@/types/db';

type Result = { barcode: string; product: Product | null };
type Props  = { onClose: () => void };

export function ScannerView({ onClose }: Props) {
  const t                    = useTranslations('Scanner');
  const { activeMembership } = useActiveBranch();
  const tenantId             = activeMembership?.tenant_id;

  const [result,          setResult]          = useState<Result | null>(null);
  const [categories,      setCategories]      = useState<{ id: string; name: string }[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [pendingBarcode,  setPendingBarcode]  = useState<string | null>(null);

  // Fetch categories for ProductForm
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

  function handleProductSelect(product: ScannerProduct) {
    setResult({ barcode: product.barcode ?? '', product: product as unknown as Product });
  }

  function handleAddProduct(barcode: string) {
    setPendingBarcode(barcode || null);
    setResult(null);
    setShowProductForm(true);
  }

  return (
    <>
      <ScannerLayout
        mode="scan"
        title={t('quickScan')}
        onScanned={handleScanned}
        onProductSelect={handleProductSelect}
        onClose={onClose}
        onNewProduct={() => { setPendingBarcode(null); setShowProductForm(true); }}
      />
      <ScanResultSheet
        open={!!result}
        onClose={() => setResult(null)}
        barcode={result?.barcode ?? ''}
        product={result?.product ?? null}
        categories={categories}
        onAddProduct={handleAddProduct}
      />
      <ProductForm
        open={showProductForm}
        onOpenChange={setShowProductForm}
        categories={categories}
        prefillBarcode={pendingBarcode ?? undefined}
        variant="sheet"
      />
    </>
  );
}
