// ============================================================================
// AURAN · نواة التسعير و VAT  —  كود حرفي مقفول (لا يُترك للتفسير)
// المسار النهائي: src/lib/pricing.ts
// قاعدة ذهبية: كل الأرقام لاتينية. كل المبالغ تُدوَّر إلى 2 منزلة (fils).
// ============================================================================

/** تقريب نقدي ثابت إلى 2 منزلة عشرية (نصف لأعلى) لتفادي أخطاء الفاصلة العائمة. */
export function roundMoney(n: number): number {
  // نضيف Number.EPSILON ثم نقرّب لتفادي حالات مثل 1.005
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** تقريب الكمية إلى 3 منازل (يدعم الوزن kg). */
export function roundQty(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export interface PriceBreakdown {
  /** السعر الصافي قبل الضريبة */
  net: number;
  /** قيمة ضريبة القيمة المضافة */
  vat: number;
  /** السعر الإجمالي شامل الضريبة */
  gross: number;
  /** نسبة الضريبة المستخدمة (%) */
  vatRate: number;
}

/**
 * تفصيل السعر لوحدة واحدة.
 * @param sellPrice  السعر المُدخل من المستخدم.
 * @param vatRate    نسبة الضريبة % (افتراضي 5 للإمارات).
 * @param inclusive  هل sellPrice شامل الضريبة؟ (افتراضي true).
 *
 * inclusive=true  : sellPrice هو الإجمالي (gross). نستخرج الصافي والضريبة منه.
 * inclusive=false : sellPrice هو الصافي (net). نضيف الضريبة فوقه.
 */
export function priceBreakdown(
  sellPrice: number,
  vatRate = 5,
  inclusive = true,
): PriceBreakdown {
  const rate = vatRate / 100;

  if (inclusive) {
    const net = roundMoney(sellPrice / (1 + rate));
    const gross = roundMoney(sellPrice);
    // نشتق الضريبة من الفرق لضمان: net + vat === gross دائماً (لا فلس ضائع)
    const vat = roundMoney(gross - net);
    return { net, vat, gross, vatRate };
  } else {
    const net = roundMoney(sellPrice);
    const gross = roundMoney(net * (1 + rate));
    const vat = roundMoney(gross - net);
    return { net, vat, gross, vatRate };
  }
}

/**
 * تفصيل سطر بكمية. يُحسب على مستوى السطر ثم يُجمَّع (مطابق لمعايير الفوترة UAE).
 * نضرب أولاً ثم نقرّب — لتفادي تراكم أخطاء التقريب لكل وحدة.
 */
export function lineBreakdown(
  sellPrice: number,
  quantity: number,
  vatRate = 5,
  inclusive = true,
): PriceBreakdown {
  const rate = vatRate / 100;
  const qty = roundQty(quantity);

  if (inclusive) {
    const grossTotal = roundMoney(sellPrice * qty);
    const net = roundMoney(grossTotal / (1 + rate));
    const vat = roundMoney(grossTotal - net);
    return { net, vat, gross: grossTotal, vatRate };
  } else {
    const net = roundMoney(sellPrice * qty);
    const gross = roundMoney(net * (1 + rate));
    const vat = roundMoney(gross - net);
    return { net, vat, gross, vatRate };
  }
}

/**
 * تجميع عدة أسطر إلى إجمالي تقرير (للفواتير و تقرير VAT).
 * يجمع الصافي والضريبة المُقرَّبين لكل سطر — لا يعيد الحساب من الإجمالي.
 */
export function sumBreakdowns(lines: PriceBreakdown[]): PriceBreakdown {
  const net = roundMoney(lines.reduce((s, l) => s + l.net, 0));
  const vat = roundMoney(lines.reduce((s, l) => s + l.vat, 0));
  const gross = roundMoney(net + vat);
  const vatRate = lines[0]?.vatRate ?? 5;
  return { net, vat, gross, vatRate };
}

/**
 * هامش الربح % بناءً على التكلفة والصافي (بعد استبعاد الضريبة).
 * يعيد 0 إذا كانت التكلفة 0 لتفادي القسمة على صفر.
 */
export function marginPercent(costPrice: number, netSellPrice: number): number {
  if (costPrice <= 0) return 0;
  const m = ((netSellPrice - costPrice) / costPrice) * 100;
  return Math.round(m * 10) / 10; // منزلة واحدة
}

// ---- تنسيق العرض (لاتيني دائماً) -------------------------------------------
export function formatAED(n: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    numberingSystem: 'latn',
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatQty(n: number, unit: 'pcs' | 'kg'): string {
  const num = new Intl.NumberFormat('en-US', {
    numberingSystem: 'latn',
    maximumFractionDigits: unit === 'kg' ? 3 : 0,
  }).format(n);
  return unit === 'kg' ? `${num} kg` : num;
}
