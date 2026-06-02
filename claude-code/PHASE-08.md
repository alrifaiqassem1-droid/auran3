# PHASE 08 — الجرد السريع

> الالتزام بـ `CONTEXT.md`. الهدف: جلسة جرد سلسة بالماسح، إدخال سريع للكميات، مقارنة بالمتوقّع، وتسوية المخزون عند الإغلاق.

> ⚠️ **نواة الصحّة مقفولة (CORE-LOGIC.md):** تسوية المخزون عند الإغلاق في RPC
> `close_count` داخل `core/supabase/migrations/0010_core_rpcs.sql`. **لا تُعد كتابتها.**
> استدعِ الإغلاق عبر `enqueueAndRun('close_count', { count_id })`. مهمّتك: **UI الجرد فقط.**

## الملفات (UI فقط — منطق الإغلاق من النواة)
```
src/lib/validators/count.ts
src/app/[locale]/(dashboard)/count/page.tsx              (قائمة الجلسات + زر جلسة جديدة)
src/app/[locale]/(dashboard)/count/[id]/page.tsx         (جلسة الجرد الحية)
src/app/[locale]/(dashboard)/count/actions.ts
src/components/count/count-session.tsx
src/components/count/count-line.tsx                      (سطر: متوقّع/معدود/فرق)
src/components/count/count-summary.tsx                   (ملخص الفروقات)
supabase/migrations/0004_count.sql                       (RPC: open/upsert/close)
messages: "Count"
```

## المواصفات

### جلسة جديدة
- `openCount()` ينشئ `inventory_counts` (status='open') للفرع النشط، يعيد id ويحوّل لصفحة الجلسة.

### الجلسة الحية (سرعة قصوى)
- شريط علوي ثابت: زر مسح كبير + بحث منتج، عدّاد "تم عدّ X منتج" (لاتيني).
- كل مسح/اختيار:
  - إن المنتج غير موجود في القائمة → أضفه كسطر جديد، ركّز حقل الكمية فوراً (autofocus) + beep.
  - إن موجود → ركّز حقل كميته (لا تكرار سطر).
- **حقل الكمية:** لوحة أرقام كبيرة سهلة بالإبهام؛ دعم عشري لمنتجات الوزن (kg). إدخال = حفظ تلقائي (debounce) عبر `upsertCountItem`.
- لكل سطر: `expected_qty` (من مجموع الدفعات وقت العدّ)، `counted_qty`، و**الفرق** ملوّناً: أخضر مطابق، كهرماني فرق بسيط، أحمر فرق كبير.
- يعمل بسلاسة على شبكة ضعيفة: تفاؤلية (optimistic) + إعادة محاولة (يتكامل مع PHASE 10 offline).

**actions.ts:**
- `upsertCountItem({ countId, productId, countedQty })` → RPC `upsert_count_item` تحسب `expected_qty` لحظة الإدراج (مجموع batches) وتخزّن.
- `closeCount(countId)` → RPC `close_count`:
  - status='closed', closed_at=now().
  - لكل سطر بفرق ≠ 0: أنشئ `stock_movements` (type='adjustment', quantity = counted-expected) وسوّ الدفعات:
    - عجز → اخصم بـ FEFO (أقرب انتهاءً أولاً).
    - زيادة → أضِف إلى أحدث دفعة أو أنشئ دفعة تسوية بلا تاريخ انتهاء.
  - أعد ملخص الفروقات.

### الملخّص (count-summary)
- بعد الإغلاق: جدول الفروقات (منتج، متوقّع، معدود، فرق، قيمة الفرق بالتكلفة)، إجمالي قيمة الفروقات.
- زر "تصدير" (CSV) اختياري.
- animation إغلاق ناجح.

## التحقق
- جلسة جرد بالمسح سريعة (مسح → كمية → التالي) بأقل نقرات.
- الفروقات تُحسب وتُلوّن صحيحاً، أرقام لاتينية.
- الإغلاق يسوّي المخزون (FEFO للعجز) ويسجّل حركات adjustment.
- يعمل على موبايل بسلاسة.
