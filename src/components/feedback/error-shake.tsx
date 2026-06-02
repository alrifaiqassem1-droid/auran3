'use client';

import { useReducedMotion, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  shake: boolean;
  children: ReactNode;
  className?: string;
}

export function ErrorShake({ shake, children, className }: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      animate={shake && !reduced ? { x: [0, -8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}
