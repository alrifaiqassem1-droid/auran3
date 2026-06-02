'use client';
import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useReducedMotion, motion } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw, Loader2, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useBeep } from '@/hooks/use-beep';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { lookupProduct } from '@/lib/scan/lookup-product';
import { ScanOverlay } from './scan-overlay';
import { ScanResultSheet } from './scan-result-sheet';
import type { Product } from '@/types/db';

const READER_ID = 'qr-reader-element';

type Result = { barcode: string; product: Product | null };
type Props  = { onClose: () => void };

function IconBtn({
  onClick, children, className,
}: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm active:scale-95 transition-transform',
        className,
      )}
    >
      {children}
    </button>
  );
}

// Simple status dot for the bottom info area
function StatusDot({ status }: { status: string }) {
  const cls =
    status === 'scanning' ? 'bg-emerald-400 animate-pulse' :
    status === 'starting' ? 'bg-amber-400 animate-pulse'  :
    status === 'error'    ? 'bg-red-400'                  :
                            'bg-white/30';
  return <span className={cn('inline-block h-2 w-2 rounded-full', cls)} />;
}

export function ScannerView({ onClose }: Props) {
  const t                    = useTranslations('Scanner');
  const { beep, unlock }     = useBeep();
  const { activeMembership } = useActiveBranch();
  const reduced              = useReducedMotion();
  const [flash,  setFlash]   = useState(false);
  const [result, setResult]  = useState<Result | null>(null);

  const handleScan = useCallback(async (code: string) => {
    beep();
    if (navigator.vibrate) navigator.vibrate([70, 30, 70]);
    if (!reduced) { setFlash(true); setTimeout(() => setFlash(false), 350); }

    const tenantId = activeMembership?.tenant_id;
    if (!tenantId) return;

    const product = await lookupProduct(code, tenantId);
    setResult({ barcode: code, product });
    if (!product) toast.info(t('notFound'), { description: code });
  }, [beep, reduced, activeMembership, t]);

  const scanner = useBarcodeScanner({ elementId: READER_ID, onScan: handleScan });

  useEffect(() => {
    // Always press-to-scan — force it in case localStorage had 'continuous'
    if (scanner.mode !== 'press') scanner.setMode('press');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Denied / Error ────────────────────────────────────────────
  if (scanner.status === 'denied' || scanner.status === 'error') {
    return (
      <div
        className="fixed inset-x-0 top-0 z-50 flex flex-col items-center justify-center gap-6 bg-black p-6 text-center text-white"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button onClick={onClose} className="absolute start-4 top-4">
          <X className="h-6 w-6" />
        </button>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <RotateCcw className="h-8 w-8" />
        </div>
        <div>
          <p className="text-lg font-bold">{t('permissionDenied')}</p>
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

  return (
    <>
      {/*
        The container stops ABOVE the BottomNav (4rem = 64px + safe-area).
        z-50 < BottomNav area is not covered, so BottomNav stays visible.
      */}
      <div
        className="fixed inset-x-0 top-0 z-50 flex flex-col bg-black"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        onPointerDown={unlock}
      >
        {/* ── Camera section: 60% of viewport height ───────── */}
        <div className="relative bg-black" style={{ height: '60dvh', minHeight: 260 }}>

          {/* html5-qrcode mounts here — always in DOM */}
          <div id={READER_ID} className="absolute inset-0 qr-reader-host" />

          {/* Scan box overlay (only when camera is running) */}
          {scanner.status === 'scanning' && (
            <ScanOverlay flash={flash} />
          )}

          {/* Starting spinner */}
          {scanner.status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}

          {/* ── Header (floats above camera) ──────────────── */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pb-2"
               style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>

            {/* Close */}
            <IconBtn onClick={onClose}>
              <X className="h-5 w-5" />
            </IconBtn>

            {/* Zoom + flip — hidden while camera is off */}
            <div className={cn(
              'flex items-center gap-1 transition-opacity',
              scanner.status === 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100',
            )}>
              <IconBtn onClick={() => scanner.adjustZoom(-0.5)}>
                <ZoomOut className="h-4 w-4" />
              </IconBtn>
              <IconBtn onClick={() => scanner.adjustZoom(0.5)}>
                <ZoomIn className="h-4 w-4" />
              </IconBtn>
              <IconBtn onClick={scanner.flip}>
                <RotateCcw className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
        </div>

        {/* ── Bottom section: press button / status hint ─── */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">

          {/* Press mode + idle → big scan button */}
          {scanner.status === 'idle' && (
            <>
              <motion.button
                onClick={scanner.start}
                whileTap={reduced ? {} : { scale: 0.93 }}
                whileHover={reduced ? {} : { scale: 1.04 }}
                className="relative flex h-24 w-24 flex-col items-center justify-center gap-2 rounded-full bg-primary shadow-[0_0_36px_hsl(var(--primary)/0.5)]"
              >
                {!reduced && (
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-primary opacity-60"
                    animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <ScanLine className="h-7 w-7 text-primary-foreground" />
                <span className="text-[10px] font-black tracking-wide text-primary-foreground uppercase">
                  {t('scanNow')}
                </span>
              </motion.button>
              <p className="text-xs font-medium text-white/60">{t('pressToStart')}</p>
            </>
          )}

          {/* Camera active → status + hint */}
          {scanner.status !== 'idle' && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
                <StatusDot status={scanner.status} />
                <span className="text-xs font-medium text-white">
                  {scanner.status === 'starting' ? t('starting') : t('ready')}
                </span>
              </div>
              <p className="text-[11px] text-white/50">{t('aimCamera')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Result sheet renders outside the scanner container so it can be full-screen */}
      <ScanResultSheet
        open={!!result}
        onClose={() => setResult(null)}
        barcode={result?.barcode ?? ''}
        product={result?.product ?? null}
      />
    </>
  );
}
