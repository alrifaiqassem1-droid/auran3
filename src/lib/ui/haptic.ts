function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/** 10 ms — light tap feedback for UI interactions. */
export function hapticLight(): void   { vibrate(10); }

/** [20, 50, 20] — success: barcode scan confirmed, receipt saved. */
export function hapticSuccess(): void { vibrate([20, 50, 20]); }

/** [80, 30, 80] — error: scan failed, insufficient stock, form error. */
export function hapticError(): void   { vibrate([80, 30, 80]); }

/** 40 ms — warning: expiry alert, low stock threshold crossed. */
export function hapticWarning(): void { vibrate(40); }
