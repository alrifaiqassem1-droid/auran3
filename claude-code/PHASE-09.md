# PHASE 09 — استيراد مبيعات POS + تقارير ضريبية

> الالتزام بـ `CONTEXT.md`. الهدف: استيراد ملف مبيعات من نظام POS، مطابقة المنتجات، خصم المخزون (FEFO)، وتقرير VAT.

## التثبيت
```bash
npm install papaparse
npm install -D @types/papaparse
npx shadcn@latest add progress
```

> ⚠️ **نواة الصحّة مقفولة (CORE-LOGIC.md):** خصم المخزون والمطابقة في RPC
> `apply_pos_import` داخل `core/supabase/migrations/0010_core_rpcs.sql`. **لا تُعد كتابتها.**
> استدعِ عبر `enqueueAndRun('apply_pos_import', payload)`. تقرير VAT يستخدم `priceBreakdown/sumBreakdowns`
> من نواة `src/lib/pricing.ts`. مهمّتك: **UI الرفع/المطابقة/المعاينة والتقارير فقط.**

## الملفات (UI فقط — منطق الاستيراد و VAT من النواة)
```
src/lib/validators/pos.ts
src/lib/pos/parse-csv.ts                       (تحليل + كشف الأعمدة)
src/app/[locale]/(dashboard)/import/page.tsx   (رفع + معاينة + مطابقة + تأكيد)
src/app/[locale]/(dashboard)/import/actions.ts
src/components/import/file-drop.tsx
src/components/import/column-mapper.tsx         (ربط أعمدة الملف بالحقول)
src/components/import/import-preview.tsx
src/app/[locale]/(dashboard)/reports/page.tsx  (تقارير)
src/components/reports/vat-report.tsx
supabase/migrations/0005_pos.sql               (RPC: apply_pos_import)
messages: "Import", "Reports"
```

## المواصفات

### الاستيراد
- **رفع:** `file-drop` يقبل CSV/Excel (CSV أولاً عبر papaparse). اعرض اسم الملف وعدد الصفوف.
- **كشف الأعمدة تلقائياً** ثم `column-mapper` للتأكيد: ربط أعمدة الملف بـ `barcode | product_name | quantity | total | sold_at`.
  - ادعم تنسيقات POS2 الشائعة؛ اجعل المابر مرناً لأي ترويسة.
- **معاينة + مطابقة:** لكل صف، طابق `barcode` (ثم الاسم) بمنتج موجود:
  - مطابَق ✅ / غير مطابَق ⚠️ (زر "اربط يدوياً" أو "تجاهل").
  - لخّص: س صف مطابَق، ص غير مطابَق.
- **تأكيد:** زر "استيراد"، مع `progress` أثناء المعالجة.

**actions.ts → `applyPosImport(input)`** (RPC `apply_pos_import` في `0005_pos.sql`):
1. Zod + صلاحية (manager+).
2. أنشئ `pos_imports` (header) + `pos_import_items` للصفوف.
3. لكل صف مطابَق: اخصم الكمية من المخزون بـ **FEFO** (أعد استخدام منطق fefo.ts/RPC)، وأنشئ `stock_movements` (type='sale', quantity سالب).
4. الصفوف غير المطابقة: تُسجَّل بلا خصم (للمراجعة).
- ذرّي قدر الإمكان عبر RPC. أعد ملخص: مطابَق/غير مطابَق/أخطاء.
- نجاح → animation + toast.

### التقارير الضريبية (VAT)
- `reports/page.tsx`: اختيار فترة (اليوم/الأسبوع/الشهر/مخصّص) + الفرع.
- **vat-report:** من حركات البيع + أسعار المنتجات، احسب لكل فترة:
  - إجمالي المبيعات (gross)، الصافي (net)، **VAT 5%** المُحصّل، عدد المعاملات.
  - تفصيل حسب الفئة (اختياري).
  - استخدم `pricing.ts` (PHASE 06) لاتساق الحساب.
- عرض: بطاقات مؤشرات + جدول + (اختياري) رسم بسيط. أرقام لاتينية، عملة AED.
- زر "تصدير CSV/PDF" (CSV كافٍ الآن).
- اعرض `TRN` الخاص بالـ tenant في رأس التقرير إن وُجد.

## التحقق
- استيراد CSV نموذجي يطابق المنتجات ويخصم المخزون بـ FEFO.
- الصفوف غير المطابقة لا تكسر العملية.
- تقرير VAT يحسب 5% بدقّة ويطابق المبيعات.
- أرقام لاتينية + AED، RTL/LTR.
