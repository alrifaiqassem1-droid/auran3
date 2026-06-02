'use client';
import { motion, useReducedMotion } from 'framer-motion';
import type { ScanStatus } from '@/hooks/use-barcode-scanner';

type Props = { flash: boolean; status?: ScanStatus };

// ─── Corner bracket ───────────────────────────────────────────
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const cls: Record<string, string> = {
    tl: 'top-0 start-0 border-t-2 border-s-2 rounded-ss-xl',
    tr: 'top-0 end-0   border-t-2 border-e-2 rounded-se-xl',
    bl: 'bottom-0 start-0 border-b-2 border-s-2 rounded-es-xl',
    br: 'bottom-0 end-0   border-b-2 border-e-2 rounded-ee-xl',
  };
  return <div className={`absolute h-6 w-6 border-primary ${cls[pos]}`} />;
}

// ─── Scan box: corners + laser + success flash ────────────────
function ScanBox({ flash }: { flash: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="relative w-full"
      style={{
        maxWidth: 300,
        paddingTop: '42%',                         // ~16:7 wide box, good for 1D barcodes
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.60)',
        borderRadius: 12,
      }}
    >
      <Corner pos="tl" /> <Corner pos="tr" />
      <Corner pos="bl" /> <Corner pos="br" />

      {/* Gold laser line */}
      {!reduced && (
        <motion.div
          className="absolute inset-x-2 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_2px_hsl(var(--primary)/0.8)]"
          animate={{ top: ['10%', '84%', '10%'] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Success flash */}
      <motion.div
        className="absolute inset-0 rounded-xl border-2 border-emerald-400 bg-emerald-400/15"
        animate={{ opacity: flash ? 1 : 0 }}
        transition={{ duration: 0.12 }}
      />
    </div>
  );
}

// ─── Overlay (only shown while camera is scanning) ────────────
export function ScanOverlay({ flash }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 select-none">
      <ScanBox flash={flash} />
    </div>
  );
}
