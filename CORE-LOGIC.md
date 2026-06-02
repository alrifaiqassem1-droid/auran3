# CORE-LOGIC — نواة الصحّة (كود حرفي مقفول)

> هذه الملفات **لا تُولَّد ولا تُفسَّر** من Claude Code. انسخها حرفياً إلى مساراتها.
> أي خطأ هنا يكلّف مالاً ومخزوناً، لذلك كُتبت ودُقّقت يدوياً.

## الملفات ومساراتها النهائية داخل المشروع
```
core/src/lib/pricing/pricing.ts   →  src/lib/pricing.ts
core/src/lib/stock/fefo.ts        →  src/lib/stock/fefo.ts
core/src/lib/offline/db.ts        →  src/lib/offline/db.ts
core/src/lib/offline/queue.ts     →  src/lib/offline/queue.ts
core/supabase/migrations/0010_core_rpcs.sql → supabase/migrations/0010_core_rpcs.sql
```

## ماذا تضمن كل قطعة

**pricing.ts** — التسعير و VAT 5%.
- `priceBreakdown` / `lineBreakdown` / `sumBreakdowns`: حساب net/vat/gross بحيث **net + vat = gross دائماً** (لا فلس ضائع).
- تقريب نقدي ثابت (`roundMoney`) يتفادى أخطاء الفاصلة العائمة.
- `formatAED` / `formatQty`: عرض لاتيني، AED، ودعم kg.

**fefo.ts** — ترتيب وتوزيع الدفعات.
- `sortFefo`: الترتيب الرسمي `expiry_date ASC NULLS LAST, received_at ASC`.
  ⚠️ **مطابق حرفياً** للترتيب في الـ SQL. لا تغيّر أحدهما دون الآخر.
- `allocateFefo`: معاينة التوزيع في الواجهة قبل التأكيد.
- `expiryStatus` / `daysUntilExpiry`: تلوين شارات الانتهاء (expired/critical/warning/safe).

**0010_core_rpcs.sql** — العمليات الذرّية في Postgres (مصدر الحقيقة للكتابة).
- `receive_goods`, `record_damage`, `close_count`, `apply_pos_import`.
- كلها **ذرّية** (كل-أو-لا-شيء)، تتحقق من العضوية والدور (`_guard`)، وتأخذ `tenant_id`
  من الفرع لا من العميل، وتستخدم `FOR UPDATE` لمنع سباق تعديل الدفعات.
- **idempotency** عبر جدول `processed_ops` ومفتاح `client_op_id`: إعادة تنفيذ نفس العملية
  تعيد النتيجة المخزّنة بدل تكرارها (أساس أمان الـ offline sync).

**offline/db.ts + queue.ts** — الطابور دون اتصال.
- `enqueueAndRun(type, payload)`: نقطة الدخول الموحّدة لكل عملية حرجة.
  يولّد `client_op_id`، يسجّل في IndexedDB، ينفّذ فوراً إن أمكن، وإلا يطابر.
- `flushQueue` + `registerAutoFlush`: مزامنة تلقائية عند عودة الاتصال، آمنة للتكرار.
- `pendingCount`: عدد المعلّق لمؤشّر الواجهة.

## كيف يستهلكها كل Server Action / مكوّن

بدل أن يكتب Claude Code منطق الاستلام/التالف/الجرد/الاستيراد يدوياً، **يستدعي النواة**:

```ts
// مثال: تأكيد استلام بضاعة (يعمل أونلاين/أوفلاين بنفس السطر)
import { enqueueAndRun } from '@/lib/offline/queue';

const res = await enqueueAndRun('receive_goods', {
  branch_id: activeBranchId,
  supplier_id: supplierId ?? null,
  reference,
  lines: cart.map(l => ({
    product_id: l.productId, quantity: l.qty,
    cost_price: l.cost, expiry_date: l.expiry ?? null,
  })),
});

if (res.ok && !res.queued)      showSuccess();         // نُفّذ على السيرفر
else if (res.ok && res.queued)  showSavedOffline();    // حُفظ للمزامنة
else                            showError(res.error);
```

```ts
// مثال: تفصيل VAT حي في نموذج المنتج
import { priceBreakdown, formatAED } from '@/lib/pricing';
const { net, vat, gross } = priceBreakdown(sellPrice, tenant.vat_rate, vatInclusive);
```

```ts
// مثال: تلوين دفعة في جدول الدفعات
import { expiryStatus } from '@/lib/stock/fefo';
const status = expiryStatus(batch.expiry_date); // 'critical' → شارة حمراء
```

## القاعدة لـ Claude Code
- **لا** تُعِد كتابة هذه الملفات. **لا** تغيّر منطقها.
- في مراحل 06/07/08/09/10: استورد من النواة بدل إعادة التنفيذ.
- إن احتجت تعديلاً، نبّه المستخدم أولاً واشرح الأثر على الذرّية/الـ idempotency.
