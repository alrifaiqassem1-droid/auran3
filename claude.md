# AURAN — دليل Claude Code

> اقرأ هذا الملف أولاً في كل جلسة. للتفاصيل الكاملة راجع `CONTEXT.md` و `CORE-LOGIC.md`.

---

## ما هو AURAN

PWA عربي-أولاً لإدارة المخزون، يستهدف الملاحم والبقالات والسوبرماركت في الخليج.
الميزة الأساسية: FEFO (الأقرب انتهاءً يخرج أولاً) لتفادي غرامات البلدية وتقليل الهدر.

- Live: https://auran.vercel.app
- Local: C:\auran
- Supabase Project ID: jqdmfbpmarxjpjcvmnvz

---

## الحقائق التقنية (لا تخمّن — هذه هي الفعلية)

Stack:
- Next.js 15.5 (App Router) + React 19 + TypeScript strict
- Supabase (PostgreSQL + Auth + RLS + Realtime) — المصادقة عبر Supabase Auth، ليس أي طرف ثالث
- Tailwind 3.4 + shadcn/ui + Framer Motion 11
- next-intl v3 — عربي RTL (افتراضي) + إنجليزي LTR
- Serwist (PWA) + html5-qrcode (السكانر) + idb (offline queue)
- next-intl middleware يجب أن يستثني /api/*

ما هو غير موجود (لا تكتب كوداً له):
- لا Stripe — التسعير اشتراك مباشر، لا بوابة دفع داخل التطبيق
- لا Twilio — التنبيهات داخل التطبيق + Resend للإيميل (بانتظار شراء الدومين)
- لا ZXing — السكانر html5-qrcode ومقفول

التسعير الفعلي: 0 AED setup · 300 Starter · 500 Professional · 1,000 Enterprise (شهرياً)

---

## ملفات مقفولة — للقراءة/الاستيراد فقط، لا تُعدَّل أبداً

src/components/scanner/scanner-layout.tsx
src/hooks/use-barcode-scanner.ts
src/lib/pricing.ts
src/lib/stock/fefo.ts
src/lib/offline/db.ts
src/lib/offline/queue.ts
supabase/migrations/0010_core_rpcs.sql

يمكن استيراد أنواع ودوال هذه الملفات (مثل `ExpiryStatus` من fefo.ts) — لكن لا تكتب داخلها سطراً واحداً.
الكاميرا تنكسر بسهولة وتسبب regressions كبيرة. منطق FEFO في TypeScript يجب أن يطابق SQL حرفياً. إن احتجت تعديلاً هنا، نبّه أولاً واشرح الأثر قبل أي سطر.

---

## قواعد العمل

1. اشرح قبل التنفيذ. مشكلة واحدة في كل مرة. لا تدمج خطوات بدون إذن صريح.
2. الردود بالعربية، الأكواد بالإنجليزية. لا خلط عربي/إنجليزي داخل الجملة.
3. الاختبار على auran.vercel.app فقط — ليس preview URLs (سبّبت فشلاً وهمياً متكرراً).
4. تغييرات Supabase SQL يدوية دائماً عبر SQL Editor — لا تُنشر تلقائياً عبر Vercel.
5. الأرقام لاتينية دائماً: Intl.NumberFormat('en-US', { numberingSystem: 'latn' }).
6. Server Components افتراضياً. أضف 'use client' فقط عند الحاجة لـ browser APIs أو state.
7. كل النصوص عبر next-intl — لا نصوص ثابتة في JSX (عدا onboarding المستثنى).
8. TypeScript strict. لا as any — استخدم as unknown as T عند الضرورة.
9. Additive-only: كل تغيير إضافي فقط — لا تحذف أو تغيّر قيمة قائمة في CSS أو tailwind.config أو ملفات الترجمة.
10. RTL بخصائص منطقية: استخدم `margin-inline-start`, `padding-inline-end`, `inset-inline-*`، وفي Tailwind: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*` — لا `margin-left/right` ولا `left/right` مطلقاً.
11. فحص build إلزامي: `npx tsc --noEmit && npm run build` قبل أي deploy — لا تُكمل إن فشل أيٌّ منهما.
12. مهارة الواجهات: استدعِ مهارة `frontend-design` قبل بناء أي مكوّن واجهة جديد.

---

## نقاط حرجة سهلة النسيان

- bootstrap_tenant يستقبل p_user_id صراحةً — auth.uid() يرجع NULL في server route handler.
- _guard(p_tenant uuid, p_roles user_role[]) — tenant أولاً (توثيق قديم عكسها).
- كل عمليات الكتابة تمرّ عبر enqueueAndRun(type, payload) — تعمل offline + idempotent عبر processed_ops.
- SECURITY DEFINER RPCs مع pgcrypto تحتاج set search_path = public, extensions.
- بعد أي migration: أعد توليد database.types.ts ثم حوّله UTF-8 (الـ CLI يخرجه UTF-16).

---

## الأولوية الحالية

المبيعات قبل الميزات. الخطر الأساسي هو تنفيذ المبيعات، لا الجودة التقنية.
الهدف الأقرب: إغلاق أول عميل يدفع (قلعة بعلبك).
لا تَعِد بميزات غير مبنية — أبقِ العرض ضمن ما يقدّمه AURAN فعلاً اليوم.

---

## المهارات المتاحة

frontend-design — بناء مكوّنات الواجهة (استدعِها أولاً قبل أي مكوّن UI جديد)
.claude/skills/fefo-and-stock.md — منطق FEFO، الدفعات، حالات الانتهاء
.claude/skills/supabase-rpc-review.md — مراجعة RPCs الذرّية + RLS + idempotency
.claude/skills/arabic-rtl-ui.md — معايير الواجهة العربية + RTL + الأرقام اللاتينية

استدعِها بـ Planning Mode (Shift+Tab) قبل أي مهمة في مجالها.

---

آخر تحديث: يونيو 2026