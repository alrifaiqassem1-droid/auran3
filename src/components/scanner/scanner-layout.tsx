'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Zap, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useBeep } from '@/hooks/use-beep';
import { useActiveBranch } from '@/hooks/use-active-branch';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScannerMode = 'scan' | 'receive' | 'damage' | 'stocktake';

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
  mode:             ScannerMode;
  title:            string;
  onScanned:        (barcode: string) => void;
  onProductSelect?: (product: ScannerProduct) => void;
  onClose:          () => void;
}

// ─── Mode colors ──────────────────────────────────────────────────────────────

const MODE: Record<ScannerMode, { color: string; border: string }> = {
  scan:      { color: '#888780', border: '#5F5E5A' },
  receive:   { color: '#1D9E75', border: '#0F6E56' },
  damage:    { color: '#E24B4A', border: '#A32D2D' },
  stocktake: { color: '#378ADD', border: '#185FA5' },
};

const READER_ID = 'scanner-layout-reader';

const CAM_BTN =
  'flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white active:scale-90 transition-transform';

// ─── Corner frame helper ──────────────────────────────────────────────────────

function Corner({ pos, color }: { pos: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const cls = {
    tl: 'top-0 start-0 border-t-2 border-s-2',
    tr: 'top-0 end-0   border-t-2 border-e-2',
    bl: 'bottom-0 start-0 border-b-2 border-s-2',
    br: 'bottom-0 end-0   border-b-2 border-e-2',
  }[pos];
  return (
    <div
      className={`pointer-events-none absolute h-9 w-9 ${cls}`}
      style={{ borderColor: color }}
    />
  );
}

// ─── ScannerLayout ────────────────────────────────────────────────────────────

export function ScannerLayout({
  mode, title, onScanned, onProductSelect, onClose,
}: ScannerLayoutProps) {
  const t       = useTranslations('Scanner');
  const { beep, unlock } = useBeep();
  const { activeMembership } = useActiveBranch();
  const reduced = useReducedMotion();

  const readerRef  = useRef<HTMLDivElement | null>(null);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [flash,      setFlash]      = useState(false);
  const [flashLight, setFlashLight] = useState(false);
  const [isActive,   setIsActive]   = useState(true);
  const [search,     setSearch]     = useState('');
  const [products,   setProducts]   = useState<ScannerProduct[]>([]);

  const tenantId = activeMembership?.tenant_id;
  const cfg      = MODE[mode];

  const searchResults = search.trim()
    ? products
        .filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.barcode && p.barcode.includes(search)),
        )
        .slice(0, 8)
    : [];

  // Fetch products for live search
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

  // On successful decode: beep + vibrate + flash + pause 3 s then resume
  const handleScan = useCallback(
    (code: string) => {
      if (!isActive) return;
      setIsActive(false);
      if (restartRef.current) clearTimeout(restartRef.current);

      beep();
      if (navigator.vibrate) navigator.vibrate(60);
      if (!reduced) {
        setFlash(true);
        setTimeout(() => setFlash(false), 150);
      }

      onScanned(code);

      restartRef.current = setTimeout(() => setIsActive(true), 3000);
    },
    [isActive, beep, reduced, onScanned],
  );

  const scanner = useBarcodeScanner({ elementId: READER_ID, onScan: handleScan });

  // Camera starts immediately — wait one paint frame so the DOM element exists
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (readerRef.current) scanner.setMode('continuous');
    });
    return () => {
      cancelAnimationFrame(raf);
      if (restartRef.current) clearTimeout(restartRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleFlash() {
    const next = !flashLight;
    setFlashLight(next);
    try {
      const video = readerRef.current?.querySelector('video') as HTMLVideoElement | null;
      const track = (video?.srcObject as MediaStream | null)?.getVideoTracks()[0];
      await track?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
    } catch { /* torch not supported */ }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 flex flex-col bg-[#0a0a0a]"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      onPointerDown={unlock}
    >
      {/* ── Top bar (52px) ─────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{ height: 52, paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
      >
        {/* Pulsing dot — color matches mode, visible while actively scanning */}
        <div className="flex h-8 w-8 items-center justify-center">
          {isActive && scanner.status === 'scanning' && (
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ backgroundColor: cfg.color }}
              />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
            </span>
          )}
        </div>

        <p className="text-sm font-semibold text-white">{title}</p>

        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white active:scale-90 transition-transform"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Camera view (flex-1, fills most of screen) ─────────────────────── */}
      <div className="relative flex-1 overflow-hidden bg-black">

        {/* Camera mount — always in DOM so start/retry always finds the element */}
        <div ref={readerRef} id={READER_ID} className="absolute inset-0 qr-reader-host" />

        {/* White flash overlay on successful scan */}
        {flash && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-white/50" />
        )}

        {/* Corner frames + animated scan line */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="relative h-56 w-56">
            <Corner pos="tl" color={cfg.border} />
            <Corner pos="tr" color={cfg.border} />
            <Corner pos="bl" color={cfg.border} />
            <Corner pos="br" color={cfg.border} />

            {/* Scan line — moves top → bottom, alternates */}
            {isActive && !reduced && (
              <div
                className="pointer-events-none absolute inset-x-1 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${cfg.color}dd, transparent)`,
                  boxShadow: `0 0 8px 1px ${cfg.color}88`,
                  animation: 'auran-scan 2.5s ease-in-out infinite alternate',
                }}
              />
            )}
          </div>
        </div>

        {/* Right-side camera controls — zoom + flash */}
        <div className="absolute end-3 top-1/2 z-20 -translate-y-1/2 flex flex-col gap-2">
          <button onClick={() => scanner.adjustZoom(0.5)} className={CAM_BTN} aria-label={t('zoomIn')}>
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => scanner.adjustZoom(-0.5)} className={CAM_BTN} aria-label={t('zoomOut')}>
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggleFlash}
            className={`${CAM_BTN} ${flashLight ? 'border-yellow-400/60 bg-yellow-500/70' : ''}`}
            aria-label={t('flash')}
          >
            <Zap className={`h-3.5 w-3.5 ${flashLight ? 'text-yellow-100' : 'text-white/60'}`} />
          </button>
        </div>

        {/* Denied / Error overlay — keeps camera div in DOM so retry works */}
        {(scanner.status === 'denied' || scanner.status === 'error') && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]/95 p-6 text-center">
            <p className="text-sm font-semibold text-white">{t('permissionDenied')}</p>
            <p className="text-xs text-white/50">{t('permissionDeniedDesc')}</p>
            <button
              onClick={() => { setIsActive(true); scanner.start(); }}
              className="mt-1 rounded-full bg-white/10 px-5 py-2.5 text-xs font-medium text-white active:scale-95 transition-transform"
            >
              {t('retry')}
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom section — search bar only ───────────────────────────────── */}
      <div className="shrink-0 bg-[#111111] px-4 pb-3 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/6 pe-4 ps-9 text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>

        {search.trim() && (
          <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1a] divide-y divide-white/5">
            {searchResults.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-white/30">{t('noSearchResults')}</p>
            ) : (
              searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSearch('');
                    if (onProductSelect) onProductSelect(p);
                    else onScanned(p.barcode ?? p.id);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-white/5 transition-colors"
                >
                  <span className="flex-1 truncate text-sm text-white">{p.name}</span>
                  <span className="shrink-0 text-[10px] uppercase text-white/30">{p.unit}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
