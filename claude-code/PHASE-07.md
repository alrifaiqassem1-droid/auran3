# PHASE 07 — استلام البضاعة + المنتجات التالفة

> الالتزام بـ `CONTEXT.md`. الهدف: استلام سريع بالماسح ينشئ دفعات (batches) بتواريخ انتهاء، وتسجيل تالف يخصم من المخزون بمنطق FEFO.

> ⚠️ **نواة الصحّة مقفولة (CORE-LOGIC.md):** منطق الذرّية موجود في RPCs Postgres
> `receive_goods` و `record_damage` داخل `core/supabase/migrations/0010_core_rpcs.sql`،
> وتوزيع FEFO في `core/src/lib/stock/fefo.ts`. **لا تُعد كتابتها.**
> استدعِ العمليات عبر `enqueueAndRun('receive_goods'|'record_damage', payload)` من
> `src/lib/offline/queue.ts` (يعمل أونلاين/أوفلاين تلقائياً). مهمّتك هنا: **الـ UI والتدفّق فقط.**

## الملفات (UI فقط — المنطق من النواة)
```
src/lib/validators/receiving.ts
src/lib/validators/damage.ts
src/app/[locale]/(dashboard)/receiving/page.tsx
src/app/[locale]/(dashboard)/receiving/actions.ts
src/app/[locale]/(dashboard)/damage/page.tsx
src/app/[locale]/(dashboard)/damage/actions.ts
src/components/receiving/receive-cart.tsx        (سلة الاستلام)
src/components/receiving/receive-line.tsx        (سطر: كمية/تكلفة/انتهاء)
src/components/receiving/supplier-select.tsx
src/components/damage/damage-form.tsx
src/lib/stock/fefo.ts                             (منطق FEFO للخصم)
messages: "Receiving", "Damage"
```

## المواصفات

### استلام البضاعة (تدفّق سريع)
- زر "ابدأ استلام" → يفتح الماسح (أعد استخدام PHASE 05).
- كل مسح ناجح يضيف **سطراً** في سلة الاستلام: المنتج + حقول قابلة للتعديل: `الكمية`, `سعر التكلفة`, `تاريخ الانتهاء`.
  - منتج غير معروف → خيار سريع "إنشاء منتج" inline (Dialog مختصر من PHASE 06).
  - منتجات الوزن (kg): لوحة إدخال كمية عشرية واضحة.
- مسح نفس المنتج مرة أخرى → يزيد كمية السطر (لا تكرار أسطر).
- إجمالي حي: عدد الأسطر + إجمالي التكلفة (لاتيني).
- زر "تأكيد الاستلام".

**actions.ts → `confirmReceipt(input)`** (Server Action، معاملة منطقية):
1. تحقّق Zod + صلاحية (staff+).
2. أنشئ `goods_receipts` (header) بـ `supplier_id`, `total_cost`, `created_by`.
3. لكل سطر:
   - أنشئ `stock_batches` (quantity, cost_price, expiry_date, received_at).
   - أنشئ `goods_receipt_items` مرتبطاً بـ batch.
   - أنشئ `stock_movements` (type='receipt', quantity موجب, batch_id, reference_id=receipt.id).
4. `revalidatePath` للمنتجات/الداشبورد. أعد `{ ok, receiptId }`.
> نفّذ هذا عبر **RPC في Postgres** (دالة `receive_goods(jsonb)`) لضمان الذرّية (atomicity)، أو عبر عدة inserts متتابعة مع معالجة خطأ. الأفضل RPC. أضف الـ SQL في `supabase/migrations/0002_receiving.sql`.
- عند النجاح: animation نجاح + beep + toast، وتفريغ السلة.

### المنتجات التالفة
- `damage-form`: اختر المنتج (بالمسح أو بحث) → اختر `reason` (expired/broken/spoiled/other) → كمية → ملاحظة.
- إن كان السبب `expired`، اقترح **الدفعة المنتهية الأقرب** تلقائياً (FEFO).

**fefo.ts → `allocateFefo(productId, branchId, qty)`**:
- اجلب دفعات المنتج في الفرع بكمية > 0، مرتّبة `expiry_date ASC NULLS LAST, received_at ASC`.
- وزّع الكمية المطلوبة على الدفعات بالترتيب، أعد قائمة `[{ batchId, take }]`.
- إن لم تكفِ الكميات → خطأ "مخزون غير كافٍ".

**actions.ts → `recordDamage(input)`** (RPC `record_damage` في `0003_damage.sql`):
1. Zod + صلاحية.
2. `allocateFefo` لتحديد الدفعات.
3. لكل تخصيص: أنقص `stock_batches.quantity`، أنشئ `damaged_products`، أنشئ `stock_movements` (type='damage', quantity سالب).
4. أنشئ إشعار (type='damage') — يُربط فعلياً في PHASE 10.
- نجاح → animation + toast.

## التحقق
- استلام منتج ينشئ دفعة بتاريخ انتهاء وتظهر في تفاصيل المنتج (PHASE 06).
- المخزون يزيد بمقدار المستلَم.
- تسجيل تالف يخصم من **أقرب دفعة انتهاءً** (FEFO) ويظهر في الحركات.
- كل العمليات ذرّية (لا حالة نصفية عند الخطأ).
