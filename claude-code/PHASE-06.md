# PHASE 06 — إدارة المنتجات + Stock Batches

> الالتزام بـ `CONTEXT.md`. الهدف: CRUD منتجات أنيق، دعم الوزن (kg)، VAT، وعرض دفعات المخزون (FEFO).

## التثبيت
```bash
npx shadcn@latest add dialog select switch tabs table command popover
```

## الملفات
```
src/lib/validators/product.ts
src/app/[locale]/(dashboard)/products/page.tsx           (قائمة + بحث + فلترة)
src/app/[locale]/(dashboard)/products/actions.ts         ('use server')
src/app/[locale]/(dashboard)/products/[id]/page.tsx      (تفاصيل + دفعات)
src/components/products/product-list.tsx
src/components/products/product-card.tsx
src/components/products/product-form.tsx                 (Dialog: إضافة/تعديل)
src/components/products/category-select.tsx
src/components/products/batches-table.tsx                (FEFO)
src/components/products/price-vat-fields.tsx
src/lib/pricing.ts            ← من النواة (CORE-LOGIC.md) — لا تكتبه
messages: "Products"
```

## المواصفات
**pricing.ts و fefo.ts:** ⚠️ **لا تكتبهما** — مأخوذان من النواة المقفولة (انظر `CORE-LOGIC.md`).
انسخ `core/src/lib/pricing/pricing.ts` → `src/lib/pricing.ts` و `core/src/lib/stock/fefo.ts` → `src/lib/stock/fefo.ts`.
استورد منهما مباشرة: `priceBreakdown`, `lineBreakdown`, `marginPercent`, `formatAED`, `formatQty`, `expiryStatus`, `daysUntilExpiry`.

**product.ts (Zod):** `name(min2)`, `barcode(optional)`, `unit('pcs'|'kg')`, `category_id(uuid optional)`, `cost_price(>=0)`, `sell_price(>=0)`, `vat_inclusive(bool)`, `low_stock_threshold(>=0)`, `is_active(bool)`.
- إن `unit==='pcs'` فالباركود مُستحسن؛ إن `kg` فقد يكون فارغاً (منتجات الوزن للملاحم).

**actions.ts:** `createProduct`, `updateProduct`, `toggleActive`, `deleteProduct` (manager+ فقط).
- نمط موحّد: Zod → صلاحية (`has_role`) → Supabase → `revalidatePath` → `{ ok, error? }`.
- التزم بـ `tenant_id` من الجلسة (لا تثق بالعميل).

**قائمة المنتجات:** 
- بحث فوري (بالاسم/الباركود) عبر `command`/input مع debounce.
- فلترة: الفئة، الحالة (نشط/متوقف)، الوحدة (pcs/kg).
- كل بطاقة: الاسم، الباركود، الوحدة، سعر البيع + شارة VAT، مؤشر المخزون الكلي (مجموع الدفعات)، وشارة حمراء إن دون الحد.
- حالات: skeleton، فارغ ("لا منتجات بعد" + زر إضافة)، خطأ.
- زر FAB "+ منتج" يفتح `product-form` Dialog. تكامل مع PHASE 05: إن جاء باركود من المسح، عبّئه مسبقاً.

**نموذج المنتج:** React Hook Form + zodResolver + shadcn. حقول السعر تُظهر **تفصيل VAT الحي** (net/vat/gross) أثناء الكتابة. مبدّل `pcs/kg`. حركة دخول ناعمة.

**تفاصيل المنتج + الدفعات:** Tabs (تفاصيل / الدفعات / الحركات).
- `batches-table`: دفعات المنتج في الفرع النشط، **مرتّبة FEFO** (`expiry_date ASC NULLS LAST`).
- لكل دفعة: الكمية المتبقية، سعر التكلفة، تاريخ الانتهاء مع **شارة لونية**:
  أحمر = منتهٍ/خلال 7 أيام، كهرماني = خلال 30 يوم، أخضر = آمن. (أرقام الأيام لاتينية).
- إجمالي المخزون = مجموع كميات الدفعات.

## التحقق
- إضافة/تعديل/حذف منتج يعمل مع RLS.
- تفصيل VAT صحيح (مثال: سعر 10.50 شامل 5% → net 10.00, vat 0.50).
- جدول الدفعات يرتّب FEFO ويلوّن تواريخ الانتهاء صحيحاً.
- بحث/فلترة سريعة. RTL/LTR + Dark/Light.
