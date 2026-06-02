'use client';

import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  show: boolean;
  onDone?: () => void;
}

export function SuccessBurst({ show, onDone }: Props) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onDone?.(), reduced ? 300 : 750);
    return () => clearTimeout(t);
  }, [show, onDone, reduced]);

  if (!show) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Gold expanding ring */}
      {!reduced && (
        <motion.div
          className="absolute rounded-full border-2 border-primary"
          initial={{ width: 0, height: 0, opacity: 0.8 }}
          animate={{ width: 200, height: 200, opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      )}
      {/* Check icon */}
      <motion.div
        className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.2, 1], opacity: 1 }}
        transition={{ duration: reduced ? 0.2 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </motion.div>
    </motion.div>
  );
}
