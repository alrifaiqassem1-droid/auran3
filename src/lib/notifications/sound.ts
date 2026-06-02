'use client';

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  return _ctx;
}

/** Urgent alarm: 3 descending sawtooth sweeps — louder and more aggressive than beep/notification */
export function playExpiryAlert() {
  const ctx = getCtx();
  if (!ctx) return;

  const play = () => {
    for (let i = 0; i < 3; i++) {
      const t0   = ctx!.currentTime + i * 0.42;
      const osc  = ctx!.createOscillator();
      const gain = ctx!.createGain();

      osc.connect(gain);
      gain.connect(ctx!.destination);

      osc.type = 'sawtooth';
      // Sweep 900 Hz → 380 Hz (descending alarm feel)
      osc.frequency.setValueAtTime(900, t0);
      osc.frequency.linearRampToValueAtTime(380, t0 + 0.32);

      gain.gain.setValueAtTime(0,   t0);
      gain.gain.linearRampToValueAtTime(0.5, t0 + 0.02);
      gain.gain.setValueAtTime(0.5, t0 + 0.29);
      gain.gain.linearRampToValueAtTime(0,   t0 + 0.38);

      osc.start(t0);
      osc.stop(t0 + 0.40);
    }
  };

  if (ctx.state === 'suspended') ctx.resume().then(play);
  else play();
}

export function playNotificationSound() {
  const ctx = getCtx();
  if (!ctx) return;

  const play = () => {
    // Two-tone notification chime
    [880, 1100].forEach((freq, i) => {
      const osc  = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.connect(gain);
      gain.connect(ctx!.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx!.currentTime + i * 0.12);

      gain.gain.setValueAtTime(0, ctx!.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.2, ctx!.currentTime + i * 0.12 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + i * 0.12 + 0.22);

      osc.start(ctx!.currentTime + i * 0.12);
      osc.stop(ctx!.currentTime + i * 0.12 + 0.25);
    });
    navigator.vibrate?.([30, 60, 30]);
  };

  if (ctx.state === 'suspended') ctx.resume().then(play);
  else play();
}
