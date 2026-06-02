import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

/** أرقام لاتينية دائماً */
export function formatNumber(n: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat('en-US', { numberingSystem: 'latn', ...opts }).format(n);
}
export function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED', numberingSystem: 'latn' }).format(n);
}
export function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai', numberingSystem: 'latn' }).format(new Date(d));
}
