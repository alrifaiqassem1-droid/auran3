'use client';
import { useRef, useCallback, useState, useEffect } from 'react';

export type ScanMode   = 'continuous' | 'press';
export type ScanStatus = 'idle' | 'starting' | 'scanning' | 'denied' | 'error';

type Options = {
  elementId: string;
  onScan: (code: string) => void;
};

const STORAGE_KEY  = 'auran:scan-mode';
const DEBOUNCE_MS  = 1200;

function loadMode(): ScanMode {
  if (typeof window === 'undefined') return 'press';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'continuous' ? 'continuous' : 'press';
  } catch { return 'press'; }
}

export function useBarcodeScanner({ elementId, onScan }: Options) {
  const scannerRef  = useRef<any>(null);
  const modeRef     = useRef<ScanMode>(loadMode());
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);
  const facingRef   = useRef<'environment' | 'user'>('environment');
  const onScanRef   = useRef(onScan);
  onScanRef.current = onScan;

  const [status, setStatus]    = useState<ScanStatus>('idle');
  const [mode,   setModeState] = useState<ScanMode>(modeRef.current);
  const [zoom,   setZoomState] = useState(1);

  // stop declared before handleDecode so we can reference stopRef
  const stopRef = useRef<() => Promise<void>>(async () => {});

  // Called on every successful decode from html5-qrcode
  const handleDecode = useCallback((code: string) => {
    if (modeRef.current === 'press') {
      // Fire immediately, then stop camera so user must press again
      onScanRef.current(code);
      setTimeout(() => stopRef.current(), 150);
      return;
    }
    // Continuous: debounce repeated reads of same barcode
    const now = Date.now();
    if (code === lastCodeRef.current && now - lastTimeRef.current < DEBOUNCE_MS) return;
    lastCodeRef.current = code;
    lastTimeRef.current = now;
    onScanRef.current(code);
  }, []);

  const start = useCallback(async () => {
    if (scannerRef.current) return;
    setStatus('starting');
    lastCodeRef.current = '';

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      const qr = new Html5Qrcode(elementId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
      });
      scannerRef.current = qr;

      const vw = typeof window !== 'undefined' ? window.innerWidth  : 390;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
      const boxW = Math.round(Math.min(vw, vh) * 0.72);
      const boxH = Math.round(boxW * 0.44);

      await qr.start(
        { facingMode: facingRef.current },
        { fps: 15, qrbox: { width: boxW, height: boxH }, aspectRatio: vh / vw },
        handleDecode,
        () => {}
      );

      setStatus('scanning');

      try {
        await qr.applyVideoConstraints({
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
        });
      } catch { /* device doesn't support */ }

    } catch (err: unknown) {
      const msg = String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setStatus('denied');
      } else {
        setStatus('error');
        if (process.env.NODE_ENV !== 'production') console.error('[scanner]', err);
      }
      try { scannerRef.current?.clear?.(); } catch { }
      scannerRef.current = null;
    }
  }, [elementId, handleDecode]);

  const stop = useCallback(async () => {
    const qr = scannerRef.current;
    if (!qr) return;
    scannerRef.current = null;
    try {
      await qr.stop();
      qr.clear?.();
    } catch { /* already stopped */ }
    setStatus('idle');
  }, []);

  // Keep stopRef in sync so handleDecode can call stop without a dependency
  useEffect(() => { stopRef.current = stop; }, [stop]);

  const setMode = useCallback((m: ScanMode) => {
    modeRef.current = m;
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* blocked */ }

    // Auto-manage camera on mode switch
    if (m === 'continuous' && !scannerRef.current) {
      start();
    } else if (m === 'press' && scannerRef.current) {
      stop();
    }
  }, [start, stop]);

  const flip = useCallback(async () => {
    facingRef.current = facingRef.current === 'environment' ? 'user' : 'environment';
    await stop();
    await start();
  }, [stop, start]);

  const adjustZoom = useCallback(async (delta: number) => {
    const qr = scannerRef.current;
    if (!qr) return;
    setZoomState(prev => {
      const next = Math.max(1, Math.min(5, Math.round((prev + delta) * 10) / 10));
      qr.applyVideoConstraints({ advanced: [{ zoom: next } as MediaTrackConstraintSet] }).catch(() => {});
      return next;
    });
  }, []);

  // Clean up on unmount
  useEffect(() => () => { stop(); }, [stop]);

  return { status, mode, zoom, setMode, start, stop, flip, adjustZoom };
}
