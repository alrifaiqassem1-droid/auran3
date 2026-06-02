/**
 * Auto-mapper مع حفظ القوالب في localStorage.
 * المفتاح: بصمة الأعمدة (headers مرتبة) — نفس الملف يحمّل نفس القالب تلقائياً.
 */
import { detectColumns } from '@/lib/pos/parse-csv';
import type { ColumnMapping } from '@/lib/pos/parse-csv';

export interface SavedTemplate {
  name:    string;
  mapping: ColumnMapping;
}

function fingerprint(headers: string[]): string {
  return [...headers].sort().join('|');
}

function storageKey(fp: string): string {
  return `auran_pos_tpl_${fp}`;
}

/** يبحث عن قالب محفوظ يطابق هذه الأعمدة */
export function loadTemplate(headers: string[]): SavedTemplate | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(fingerprint(headers)));
    return raw ? (JSON.parse(raw) as SavedTemplate) : null;
  } catch {
    return null;
  }
}

/** يحفظ القالب الحالي باسم مخصّص */
export function saveTemplate(headers: string[], mapping: ColumnMapping, name: string): void {
  if (typeof localStorage === 'undefined') return;
  const tpl: SavedTemplate = { name, mapping };
  try {
    localStorage.setItem(storageKey(fingerprint(headers)), JSON.stringify(tpl));
  } catch {
    // localStorage قد يكون ممتلئاً — نتجاهل هادئاً
  }
}

/** يحذف القالب المحفوظ لهذه الأعمدة */
export function deleteTemplate(headers: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(fingerprint(headers)));
  } catch { /* ignore */ }
}

/**
 * يُعيد أفضل mapping ممكن:
 * 1) من القالب المحفوظ إن وجد
 * 2) من الكشف التلقائي بالأنماط
 */
export function bestMapping(headers: string[]): {
  mapping: ColumnMapping;
  templateName: string | null;
} {
  const saved = loadTemplate(headers);
  if (saved) return { mapping: saved.mapping, templateName: saved.name };
  return { mapping: detectColumns(headers), templateName: null };
}
