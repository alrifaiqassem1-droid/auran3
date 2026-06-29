# Skill: مراجعة FEFO والمخزون

> استخدمه قبل أي عمل يلمس الدفعات (batches)، حالات الانتهاء، أو عرض المخزون.
> src/lib/stock/fefo.ts مقفول — هذا الـ skill للاستهلاك الصحيح منه، لا لإعادة كتابته.

---

## القاعدة الذهبية

ترتيب FEFO الرسمي:
expiry_date ASC NULLS LAST, received_at ASC

هذا الترتيب مطابق حرفياً في:
- src/lib/stock/fefo.ts → دالة sortFefo
- supabase/migrations/0010_core_rpcs.sql → داخل record_damage و apply_pos_import

تغيير أحدهما دون الآخر = خطأ مالي ومخزوني. لا تلمس أياً منهما دون تنبيه المستخدم بالأثر أولاً.

---

## ماذا تستورد من النواة (لا تعيد كتابته)

import { sortFefo, allocateFefo, expiryStatus, daysUntilExpiry } from '@/lib/stock/fefo';

const status = expiryStatus(batch.expiry_date);
// 'expired' → أحمر | 'critical' → برتقالي | 'warning' → أصفر | 'safe' → أخضر

---

## الدوال الذرّية (مصدر الحقيقة للكتابة)

كلها في 0010_core_rpcs.sql، تُستدعى عبر enqueueAndRun:

- receive_goods: استلام — ينشئ receipt + batches + movements (يضيف، لا يخصم)
- record_damage: تالف — يخصم من دفعات FEFO
- close_count: إغلاق جرد — يطبّق التسويات حسب الفرق
- apply_pos_import: استيراد مبيعات — يخصم المباع من FEFO

خصائص كل RPC:
- ذرّي (كل-أو-لا-شيء)
- يتحقق من العضوية والدور عبر _guard(p_tenant, p_roles) — tenant أولاً
- يأخذ tenant_id من الفرع، لا من العميل
- يستخدم FOR UPDATE لمنع سباق تعديل الدفعات
- idempotent عبر processed_ops + client_op_id

---

## نمط الاستهلاك الصحيح

import { enqueueAndRun } from '@/lib/offline/queue';

const res = await enqueueAndRun('record_damage', {
  branch_id: activeBranchId,
  product_id: productId,
  quantity: qty,
  reason: 'expired',
  note: note ?? null,
});

if (res.ok && !res.queued)      showSuccess();      // نُفّذ على السيرفر
else if (res.ok && res.queued)  showSavedOffline(); // حُفظ للمزامنة
else                            showError(res.error);

---

## Checklist قبل أي تعديل متعلق بالمخزون

- هل ألمس ملفاً مقفولاً؟ (fefo.ts, queue.ts, db.ts, 0010_core_rpcs.sql) → إن نعم، توقّف ونبّه
- هل أعيد كتابة منطق موجود في النواة؟ → استورده بدلاً من ذلك
- هل عملية الكتابة تمرّ عبر enqueueAndRun؟ (لا استدعاء Supabase مباشر للكتابة)
- هل أعتمد على auth.uid() داخل RPC؟ → مرّر p_user_id/p_tenant صراحةً
- هل ترتيب FEFO في أي كود جديد يطابق expiry_date ASC NULLS LAST, received_at ASC؟
- هل اختبرت على auran.vercel.app (ليس preview)؟

---

## أخطاء شائعة

"الدفعة الخطأ خُصمت" → غالباً ترتيب FEFO غير مطابق. تحقق أن الكود يستورد sortFefo ولا يعيد ترتيباً يدوياً.

"العملية تكررت بعد إعادة الاتصال" → تأكد أن client_op_id ثابت لنفس العملية، لا يُولّد جديداً عند كل محاولة.

"_guard يرفض مستخدماً صالحاً" → تحقق من ترتيب المعاملات: _guard(p_tenant, p_roles) — tenant أولاً.

---

آخر تحديث: يونيو 2026