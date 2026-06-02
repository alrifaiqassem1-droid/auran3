'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  ScanLine,
  Search,
  PlusCircle,
  History,
  Zap,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useBeep } from '@/hooks/use-beep';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { lookupProduct } from '@/lib/scan/lookup-product';
import { ScanOverlay } from './scan-overlay';
import { ScanResultSheet } from './scan-result-sheet';
import { ProductForm } from '@/components/products/product-form';
import type { Product } from '@/types/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductRow = {
  id: string;
  name: string;
  unit: 'pcs' | 'kg';
  barcode: string | null;
  sell_price: number;
  cost_price: number;
  vat_inclusive: boolean;
  low_stock_threshold: number;
};

type Result = { barcode: string; product: Product | null };
type Props  = { onClose: () => void };

const READER_ID = 'qr-reader-element';

// ─── Small round icon button ──────────────────────────────────────────────────

function RoundBtn({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-sm active:scale-90 transition-transform',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─── ScannerView ──────────────────────────────────────────────────────────────

export function ScannerView({ onClose }: Props) {
  const t                    = useTranslations('Scanner');
  const { beep, unlock }     = useBeep();
  const { activeMembership } = useActiveBranch();
  const reduced              = useReducedMotion();

  const [isActive,         setIsActive]         = useState(false);
  const [flash,            setFlash]            = useState(false);
  const [flashLight,       setFlashLight]       = useState(false);
  const [result,           setResult]           = useState<Result | null>(null);
  const [search,           setSearch]           = useState('');
  const [products,         setProducts]         = useState<ProductRow[]>([]);
  const [categories,       setCategories]       = useState<{ id: string; name: string }[]>([]);
  const [showProductForm,  setShowProductForm]  = useState(false);
  const [pendingBarcode,   setPendingBarcode]   = useState<string | null>(null);

  const tenantId = activeMembership?.tenant_id;

  // ── Live search filter ─────────────────────────────────────────────────────
  const searchResults = search.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.barcode && p.barcode.includes(search)),
        )
        .slice(0, 8)
    : [];

  // ── Fetch products + categories on mount ───────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    const supabase = createClient();
    Promise.all([
      supabase
        .from('products')
        .select('id, name, unit, barcode, sell_price, cost_price, vat_inclusive, low_stock_threshold')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('categories')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name'),
    ]).then(([prodRes, catRes]) => {
      setProducts((prodRes.data ?? []) as ProductRow[]);
      setCategories((catRes.data ?? []) as { id: string; name: string }[]);
    });
  }, [tenantId]);

  // ── Scan callback (gated by isActive) ─────────────────────────────────────
  const handleScan = useCallback(
    async (code: string) => {
      if (!isActive) return;
      setIsActive(false);

      beep();
      if (navigator.vibrate) navigator.vibrate([70, 30, 70]);
      if (!reduced) {
        setFlash(true);
        setTimeout(() => setFlash(false), 350);
      }

      if (!tenantId) return;
      const product = await lookupProduct(code, tenantId);
      setResult({ barcode: code, product });
    },
    [isActive, beep, reduced, tenantId],
  );

  const scanner = useBarcodeScanner({ elementId: READER_ID, onScan: handleScan });

  // ── Always-on camera: continuous mode on mount ─────────────────────────────
  useEffect(() => {
    scanner.setMode('continuous');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Torch toggle (best-effort — not all devices support it) ───────────────
  async function toggleFlashLight() {
    const next = !flashLight;
    setFlashLight(next);
    try {
      const el     = document.getElementById(READER_ID);
      const video  = el?.querySelector('video') as HTMLVideoElement | null;
      const stream = video?.srcObject as MediaStream | null;
      const track  = stream?.getVideoTracks()[0];
      await track?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
    } catch { /* device doesn't support torch */ }
  }

  // ── SCAN button press ──────────────────────────────────────────────────────
  function handleScanPress() {
    if (isActive) return;
    if (scanner.status === 'idle' || scanner.status === 'error') {
      scanner.start();
    }
    setIsActive(true);
  }

  // ── Product selected from search ───────────────────────────────────────────
  function handleSearchSelect(p: ProductRow) {
    setSearch('');
    setResult({ barcode: p.barcode ?? '', product: p as unknown as Product });
  }

  // ── "Add New Product" from result sheet ───────────────────────────────────
  function handleAddProduct(barcode: string) {
    setPendingBarcode(barcode || null);
    setResult(null);
    setShowProductForm(true);
  }

  // ── Denied / Error ────────────────────────────────────────────────────────
  if (scanner.status === 'denied' || scanner.status === 'error') {
    return (
      <div
        className="fixed inset-x-0 top-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0a0a0a] p-6 text-center"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={onClose}
          className="absolute end-4 top-4 text-white/60"
          style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)' }}
        >
          <X className="h-6 w-6" />
        </button>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <RotateCcw className="h-8 w-8 text-white" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">{t('permissionDenied')}</p>
          <p className="mt-2 text-sm text-white/60">{t('permissionDeniedDesc')}</p>
        </div>
        <button
          onClick={() => scanner.start()}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          <RotateCcw className="h-4 w-4" />
          {t('retry')}
        </button>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-50 flex flex-col bg-[#0a0a0a]"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        onPointerDown={unlock}
      >
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div
          className="flex shrink-0 items-center justify-between px-4"
          style={{
            height: 48,
            paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
          }}
        >
          <button
            onClick={() => toast.info('Coming soon')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/60 active:scale-90 transition-transform"
          >
            <History className="h-4 w-4" />
          </button>

          <p className="text-sm font-semibold text-white">{t('quickScan')}</p>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/60 active:scale-90 transition-transform"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Camera ──────────────────────────────────────────────────────── */}
        <div
          className="relative shrink-0 bg-black"
          style={{ height: '55dvh', minHeight: 220 }}
        >
          {/* html5-qrcode mounts here — always in DOM */}
          <div id={READER_ID} className="absolute inset-0 qr-reader-host" />

          {/* Corner-frame overlay — always visible */}
          <ScanOverlay flash={flash} />

          {/* Starting spinner */}
          {scanner.status === 'starting' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-10 w-10 animate-spin text-[#1D9E75]" />
            </div>
          )}

          {/* Right-side controls */}
          <div className="absolute end-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
            <RoundBtn onClick={() => scanner.adjustZoom(0.5)}>
              <ZoomIn className="h-4 w-4" />
            </RoundBtn>
            <RoundBtn onClick={() => scanner.adjustZoom(-0.5)}>
              <ZoomOut className="h-4 w-4" />
            </RoundBtn>
            <RoundBtn
              onClick={toggleFlashLight}
              className={flashLight ? 'border-yellow-400/60 bg-yellow-500/70' : ''}
            >
              <Zap className={cn('h-4 w-4', flashLight ? 'text-yellow-100' : 'text-white/70')} />
            </RoundBtn>
          </div>
        </div>

        {/* ── Bottom section ───────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#111111]">

          {/* Search bar */}
          <div className="shrink-0 px-4 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/6 ps-9 pe-4 text-sm text-white placeholder:text-white/30 focus:border-[#1D9E75]/50 focus:outline-none transition-colors"
              />
            </div>

            {/* Search results dropdown */}
            <AnimatePresence>
              {search.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                  className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1a] divide-y divide-white/5"
                >
                  {searchResults.length === 0 ? (
                    <p className="px-4 py-3 text-center text-sm text-white/30">
                      {t('noSearchResults')}
                    </p>
                  ) : (
                    searchResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSearchSelect(p)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-white/5 transition-colors"
                      >
                        <Package className="h-4 w-4 shrink-0 text-white/30" />
                        <span className="flex-1 truncate text-sm text-white">{p.name}</span>
                        <span className="shrink-0 text-[10px] uppercase text-white/30">{p.unit}</span>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Center: SCAN button + quick action buttons */}
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-4">

            {/* SCAN button */}
            <motion.button
              onClick={handleScanPress}
              whileTap={reduced ? {} : { scale: 0.92 }}
              disabled={scanner.status === 'starting'}
              className="relative flex h-20 w-20 flex-col items-center justify-center gap-1.5 rounded-full bg-[#1D9E75] shadow-[0_0_40px_rgba(29,158,117,0.4)] disabled:opacity-50 transition-transform"
            >
              {/* Dual pulse rings when active */}
              {isActive && !reduced && (
                <>
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-[#1D9E75]"
                    animate={{ scale: [1, 1.65], opacity: [0.8, 0] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-[#1D9E75]"
                    animate={{ scale: [1, 1.65], opacity: [0.8, 0] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut', delay: 0.55 }}
                  />
                </>
              )}
              <ScanLine className="h-7 w-7 text-white" />
              <span className="text-[9px] font-black tracking-widest text-white/90 uppercase">
                {isActive ? t('scanning') : t('scanNow')}
              </span>
            </motion.button>

            {/* Quick action buttons */}
            <div className="flex w-full gap-3">
              <button
                onClick={() => toast.info('Coming soon')}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/5 text-xs font-medium text-white/60 active:bg-white/10 transition-colors"
              >
                <History className="h-3.5 w-3.5" />
                {t('recentScans')}
              </button>
              <button
                onClick={() => { setPendingBarcode(null); setShowProductForm(true); }}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/5 text-xs font-medium text-white/60 active:bg-white/10 transition-colors"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                {t('newProduct')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result sheet */}
      <ScanResultSheet
        open={!!result}
        onClose={() => setResult(null)}
        barcode={result?.barcode ?? ''}
        product={result?.product ?? null}
        categories={categories}
        onAddProduct={handleAddProduct}
      />

      {/* Product creation form */}
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
