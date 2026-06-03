'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Trash2,
  ClipboardList,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useBeep } from '@/hooks/use-beep';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { ScanOverlay } from './scan-overlay';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ScannerMode = 'receive' | 'damage' | 'stocktake' | 'quicksale' | 'pricing' | 'scan';

export type ScannerProduct = {
  id: string;
  name: string;
  unit: 'pcs' | 'kg';
  barcode: string | null;
  sell_price: number;
  cost_price: number;
  vat_inclusive: boolean;
  low_stock_threshold: number;
};

export interface ScannerLayoutProps {
  mode:            ScannerMode;
  title:           string;
  onScanned:       (barcode: string) => void;
  onProductSelect: (product: ScannerProduct) => void;
  onClose:         () => void;
  onNewProduct?:   () => void;
}

// ─── Mode config ──────────────────────────────────────────────────────────────

type ModeConfig = { color: string; shadow: string; icon: React.ReactNode };

const MODE_CONFIG: Record<ScannerMode, ModeConfig> = {
  receive:   { color: '#1D9E75', shadow: 'rgba(29,158,117,0.4)',  icon: <Package       className="h-7 w-7 text-white" /> },
  damage:    { color: '#E24B4A', shadow: 'rgba(226,75,74,0.4)',   icon: <Trash2        className="h-7 w-7 text-white" /> },
  stocktake: { color: '#378ADD', shadow: 'rgba(55,138,221,0.4)',  icon: <ClipboardList className="h-7 w-7 text-white" /> },
  quicksale: { color: '#EF9F27', shadow: 'rgba(239,159,39,0.4)',  icon: <Zap           className="h-7 w-7 text-white" /> },
  pricing:   { color: '#7F77DD', shadow: 'rgba(127,119,221,0.4)', icon: <Tag           className="h-7 w-7 text-white" /> },
  scan:      { color: '#888780', shadow: 'rgba(136,135,128,0.4)', icon: <ScanLine      className="h-7 w-7 text-white" /> },
};

const READER_ID = 'scanner-layout-reader';

const ROUND_BTN =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-sm active:scale-90 transition-transform';

// ─── ScannerLayout ────────────────────────────────────────────────────────────

export function ScannerLayout({
  mode,
  title,
  onScanned,
  onProductSelect,
  onClose,
  onNewProduct,
}: ScannerLayoutProps) {
  const t       = useTranslations('Scanner');
  const { beep, unlock } = useBeep();
  const { activeMembership } = useActiveBranch();
  const reduced = useReducedMotion();

  // isActive=true on mount → camera scans immediately, no button press needed
  const [isActive,   setIsActive]   = useState(true);
  const [flash,      setFlash]      = useState(false);
  const [flashLight, setFlashLight] = useState(false);
  const [search,     setSearch]     = useState('');
  const [products,   setProducts]   = useState<ScannerProduct[]>([]);

  // Timer ref for 3-second auto-restart after successful scan
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to the camera host div — used to guard start() and for torch access
  const readerRef = useRef<HTMLDivElement | null>(null);

  const tenantId = activeMembership?.tenant_id;
  const cfg      = MODE_CONFIG[mode];

  // ── Live search filter ────────────────────────────────────────────────────
  const searchResults = search.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.barcode && p.barcode.includes(search)),
        )
        .slice(0, 8)
    : [];

  // ── Fetch products for search ─────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    createClient()
      .from('products')
      .select('id, name, unit, barcode, sell_price, cost_price, vat_inclusive, low_stock_threshold')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setProducts((data ?? []) as ScannerProduct[]));
  }, [tenantId]);

  // ── Cleanup restart timer on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, []);

  // ── Scan callback: gated by isActive, auto-restarts after 3 s ────────────
  const handleScan = useCallback(
    (code: string) => {
      if (!isActive) return;

      // Deactivate immediately to prevent double-fire
      setIsActive(false);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

      beep();
      if (navigator.vibrate) navigator.vibrate([70, 30, 70]);
      if (!reduced) { setFlash(true); setTimeout(() => setFlash(false), 350); }

      onScanned(code);

      // Auto-restart scanning after 3 seconds (ready for next item)
      restartTimerRef.current = setTimeout(() => setIsActive(true), 3000);
    },
    [isActive, beep, reduced, onScanned],
  );

  const scanner = useBarcodeScanner({ elementId: READER_ID, onScan: handleScan });

  // ── Always-on camera: wait one paint frame so the DOM element exists ─────
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (readerRef.current) scanner.setMode('continuous');
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Torch toggle ──────────────────────────────────────────────────────────
  async function toggleFlash() {
    const next = !flashLight;
    setFlashLight(next);
    try {
      const video = readerRef.current?.querySelector('video') as HTMLVideoElement | null;
      const track = (video?.srcObject as MediaStream | null)?.getVideoTracks()[0];
      await track?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
    } catch { /* torch not supported */ }
  }

  // ── SCAN button: toggle pause / resume ────────────────────────────────────
  function handleScanPress() {
    if (scanner.status === 'idle' || scanner.status === 'error') {
      // Camera not running — start it and activate
      scanner.start();
      setIsActive(true);
      return;
    }
    // Cancel any pending auto-restart
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    // Toggle active state
    setIsActive((prev) => !prev);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  // z-40: result sheets (z-50) appear on top when open
  // The camera div is ALWAYS rendered so retry/torch can find the element.
  return (
    <div
      className="fixed inset-x-0 top-0 z-40 flex flex-col bg-[#0a0a0a]"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      onPointerDown={unlock}
    >
      {/* Top bar */}
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{ height: 48, paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
      >
        <button
          onClick={() => toast.info('Coming soon')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/60 active:scale-90 transition-transform"
        >
          <History className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-white">{title}</p>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/60 active:scale-90 transition-transform"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Camera — div is always in DOM so start()/retry() can find the element */}
      <div className="relative shrink-0 bg-black" style={{ height: '55dvh', minHeight: 220 }}>
        <div ref={readerRef} id={READER_ID} className="absolute inset-0 qr-reader-host" />
        <ScanOverlay flash={flash} />
        {scanner.status === 'starting' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: cfg.color }} />
          </div>
        )}
        {/* Denied / error overlay — rendered over the camera div so the div stays mounted */}
        {(scanner.status === 'denied' || scanner.status === 'error') && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0a0a0a] p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <RotateCcw className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-white">{t('permissionDenied')}</p>
              <p className="mt-1 text-xs text-white/50">{t('permissionDeniedDesc')}</p>
            </div>
            <button
              onClick={() => { setIsActive(true); scanner.start(); }}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              {t('retry')}
            </button>
          </div>
        )}
        {/* Right-side controls */}
        <div className="absolute end-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          <button onClick={() => scanner.adjustZoom(0.5)} className={ROUND_BTN}>
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => scanner.adjustZoom(-0.5)} className={ROUND_BTN}>
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={toggleFlash}
            className={cn(ROUND_BTN, flashLight && 'border-yellow-400/60 bg-yellow-500/70')}
          >
            <Zap className={cn('h-4 w-4', flashLight ? 'text-yellow-100' : 'text-white/70')} />
          </button>
        </div>
      </div>

      {/* Bottom section */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#111111]">
        {/* Search bar */}
        <div className="shrink-0 px-4 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/6 ps-9 pe-4 text-sm text-white placeholder:text-white/30 focus:outline-none transition-colors"
            />
          </div>
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
                      onClick={() => { setSearch(''); onProductSelect(p); }}
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

        {/* Center: SCAN button (pause/resume toggle) + quick buttons */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-4">

          {/* SCAN button */}
          <motion.button
            onClick={handleScanPress}
            whileTap={reduced ? {} : { scale: 0.92 }}
            disabled={scanner.status === 'starting'}
            className="relative flex h-20 w-20 flex-col items-center justify-center gap-1.5 rounded-full disabled:opacity-50 transition-transform"
            style={{ backgroundColor: cfg.color, boxShadow: `0 0 40px ${cfg.shadow}` }}
          >
            {/* Pulse rings while actively scanning */}
            {isActive && !reduced && (
              <>
                <motion.span
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: cfg.color }}
                  animate={{ scale: [1, 1.65], opacity: [0.8, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.span
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: cfg.color }}
                  animate={{ scale: [1, 1.65], opacity: [0.8, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut', delay: 0.55 }}
                />
              </>
            )}
            {cfg.icon}
            <span className="text-[9px] font-black tracking-widest text-white/90 uppercase">
              {isActive ? t('scanning') : t('scanNow')}
            </span>
          </motion.button>

          {/* Quick buttons */}
          <div className="flex w-full gap-3">
            <button
              onClick={() => toast.info('Coming soon')}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/5 text-xs font-medium text-white/60 active:bg-white/10 transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              {t('recentScans')}
            </button>
            <button
              onClick={onNewProduct ?? (() => toast.info('Coming soon'))}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/5 text-xs font-medium text-white/60 active:bg-white/10 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              {t('newProduct')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
