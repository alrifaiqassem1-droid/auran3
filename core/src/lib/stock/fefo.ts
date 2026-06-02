// ============================================================================
// AURAN · نواة FEFO (First Expired, First Out) — كود حرفي مقفول
// المسار النهائي: src/lib/stock/fefo.ts
//
// ملاحظة معمارية مهمة:
// التخصيص الفعلي للمخزون يتم داخل Postgres عبر RPC ذرّي (انظر ملفات الـ SQL)
// لضمان عدم وجود سباق (race conditions). هذا الملف هو:
//   1) نسخة مطابقة للمنطق تُستخدم في العرض/المعاينة قبل التأكيد.
//   2) مرجع الحقيقة الواحد لترتيب الدفعات في الواجهة.
// يجب أن يبقى منطق الترتيب هنا مطابقاً تماماً للترتيب في الـ SQL.
// ============================================================================

export interface BatchLike {
  id: string;
  /** الكمية المتبقية في الدفعة */
  quantity: number;
  /** تاريخ الانتهاء (ISO) أو null لمنتجات بلا انتهاء */
  expiry_date: string | null;
  /** وقت الاستلام (ISO) — كسر تعادل عند تساوي تواريخ الانتهاء */
  received_at: string;
}

export interface Allocation {
  batchId: string;
  /** الكمية المأخوذة من هذه الدفعة */
  take: number;
}

export interface FefoResult {
  allocations: Allocation[];
  /** الكمية التي لم نجد لها مخزوناً (0 إذا اكتفينا) */
  shortfall: number;
  /** هل المخزون كافٍ؟ */
  fulfilled: boolean;
}

/**
 * ترتيب FEFO الرسمي للدفعات.
 * القاعدة: الأقرب انتهاءً أولاً. الدفعات بلا تاريخ انتهاء (null) تأتي أخيراً.
 * عند تساوي تاريخ الانتهاء: الأقدم استلاماً أولاً (FIFO ثانوي).
 *
 * ⚠️ هذا الترتيب يجب أن يطابق حرفياً:
 *    ORDER BY expiry_date ASC NULLS LAST, received_at ASC
 */
export function sortFefo<T extends BatchLike>(batches: T[]): T[] {
  return [...batches].sort((a, b) => {
    const ae = a.expiry_date;
    const be = b.expiry_date;
    if (ae === null && be === null) {
      return a.received_at.localeCompare(b.received_at);
    }
    if (ae === null) return 1;  // a (null) بعد b
    if (be === null) return -1; // b (null) بعد a
    if (ae !== be) return ae.localeCompare(be); // الأقرب انتهاءً أولاً
    return a.received_at.localeCompare(b.received_at); // كسر التعادل
  });
}

/**
 * توزيع كمية مطلوبة على الدفعات حسب FEFO.
 * لا يعدّل المدخلات. يتجاهل الدفعات ذات الكمية <= 0.
 *
 * @param batches  دفعات منتج واحد في فرع واحد.
 * @param requestedQty  الكمية المطلوب صرفها/خصمها (> 0).
 */
export function allocateFefo(
  batches: BatchLike[],
  requestedQty: number,
): FefoResult {
  const need0 = Math.max(0, requestedQty);
  let remaining = Math.round((need0 + Number.EPSILON) * 1000) / 1000;

  const usable = sortFefo(batches.filter((b) => b.quantity > 0));
  const allocations: Allocation[] = [];

  for (const batch of usable) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    const takeRounded = Math.round((take + Number.EPSILON) * 1000) / 1000;
    if (takeRounded > 0) {
      allocations.push({ batchId: batch.id, take: takeRounded });
      remaining = Math.round((remaining - takeRounded + Number.EPSILON) * 1000) / 1000;
    }
  }

  const shortfall = Math.max(0, Math.round((remaining + Number.EPSILON) * 1000) / 1000);
  return { allocations, shortfall, fulfilled: shortfall === 0 };
}

/** درجة قُرب الانتهاء — تُستخدم لتلوين الشارات في الواجهة. */
export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'safe' | 'none';

/**
 * يصنّف تاريخ انتهاء بالنسبة لليوم الحالي.
 * expired  : مرّ تاريخه
 * critical : خلال 7 أيام
 * warning  : خلال 30 يوماً
 * safe     : أبعد من 30 يوماً
 * none     : بلا تاريخ انتهاء
 */
export function expiryStatus(
  expiryDate: string | null,
  now: Date = new Date(),
): ExpiryStatus {
  if (!expiryDate) return 'none';
  const expiry = new Date(expiryDate + 'T00:00:00');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'safe';
}

/** عدد الأيام المتبقية حتى الانتهاء (سالب إذا مرّ). null إذا بلا تاريخ. */
export function daysUntilExpiry(
  expiryDate: string | null,
  now: Date = new Date(),
): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate + 'T00:00:00');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((expiry.getTime() - today.getTime()) / 86_400_000);
}
