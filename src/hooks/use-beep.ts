'use client';
import { useRef, useCallback } from 'react';

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  return _ctx;
}

export function useBeep() {
  const readyRef = useRef(false);

  // Call once on first user interaction to unlock AudioContext
  const unlock = useCallback(() => {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    readyRef.current = true;
  }, []);

  const beep = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;

    const play = () => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'square';
      osc.frequency.setValueAtTime(1046, ctx.currentTime); // C6

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.14);

      navigator.vibrate?.(40);
    };

    if (ctx.state === 'suspended') ctx.resume().then(play);
    else play();
  }, []);

  return { beep, unlock };
}
