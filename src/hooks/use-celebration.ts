'use client';
import { useCallback } from 'react';

const COLORS = ['#C5983A', '#FFD700', '#FFF8DC', '#FFFFFF', '#F0E68C'];

function playSuccessChime() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();
    // C major arpeggio: C5 E5 G5 C6
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch { /* AudioContext blocked by browser policy */ }
}

export function useCelebration() {
  const celebrate = useCallback(async (withSound = true) => {
    const { default: confetti } = await import('canvas-confetti');

    // Central burst
    confetti({ particleCount: 160, spread: 80, origin: { y: 0.55 }, colors: COLORS });

    // Side bursts after 150ms
    setTimeout(() => {
      confetti({ particleCount: 70, angle: 60,  spread: 55, origin: { x: 0, y: 0.65 }, colors: COLORS });
      confetti({ particleCount: 70, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, colors: COLORS });
    }, 150);

    if (withSound) playSuccessChime();
  }, []);

  return { celebrate };
}
