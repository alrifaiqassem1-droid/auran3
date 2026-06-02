# CONTEXT.md — دستور مشروع AURAN

> اقرأ هذا الملف بالكامل قبل تنفيذ أي مرحلة. كل قرار في المشروع يلتزم بما هنا.

---

## 1) نظرة عامة
**AURAN** تطبيق PWA لإدارة ملحمة + سوبر ماركت في دبي. تركيزه الأساسي:
تواريخ الانتهاء (FEFO)، الجرد السريع، استلام البضاعة، المنتجات التالفة.

**الشعار/العبارة:** "يرى ما لا ترى" (Sees what you don't).

**الأولويات المطلقة (لا تنازل):**
- سلاسة وسرعة فائقة وأناقة.
- تجربة مبهرة، بسيطة، حديثة، غير تقليدية.
- لا تعقيد أبداً.
- أداء عالٍ جداً على الموبايل.

---

## 2) التقنيات والإصدارات (التزم بها حرفياً)
- **Next.js 15.1.6** (App Router) + **React 19** + **TypeScript** (strict).
- **Tailwind CSS 3.4** + **shadcn/ui** (style: new-york) + **Framer Motion 11**.
- **Supabase** (PostgreSQL) + `@supabase/ssr` + Row Level Security.
- **next-intl 3** — عربي (RTL، افتراضي) + English (LTR).
- **PWA** قابلة للتثبيت (manifest + service worker في المرحلة 10).
- **html5-qrcode** لماسح الباركود.
- **Sonner** للإشعارات.
- **Zod** + **React Hook Form** للنماذج والتحقق.
- **lucide-react** للأيقونات.

---

## 3) هيكل المجلدات (ثابت طوال المشروع)
```
auran/
├── messages/                 ar.json / en.json
├── public/                   manifest.json, sw.js (P10), أيقونات, أصوات
├── supabase/                 migrations/*.sql (P3 وما بعد)
└── src/
    ├── app/[locale]/         الصفحات (RTL/LTR تلقائي)
    │   ├── (auth)/           login, signup  (P2)
    │   └── (dashboard)/      الصفحات المحمية (P4+)
    ├── components/
    │   ├── ui/               shadcn primitives
    │   └── ...               مكونات الميزات
    ├── i18n/                 routing.ts, request.ts, navigation.ts
    ├── lib/
    │   ├── supabase/         client.ts, server.ts, middleware.ts
    │   ├── utils.ts
    │   └── ...
    ├── hooks/                custom hooks
    ├── types/                أنواع TS مشتركة (database.types.ts)
    └── middleware.ts
```

---

## 4) نظام التصميم (هوية AURAN)
**اللوحة:** أسود أوبسيديان عميق + ذهب شمبانيا. الفخامة بالهدوء لا بالضجيج.

CSS variables (HSL) — معرّفة في `globals.css`:
- Light: `--background: 40 30% 98%`, `--foreground: 24 10% 10%`, `--primary: 41 68% 48%`.
- Dark:  `--background: 240 6% 4%`,  `--foreground: 40 20% 96%`, `--primary: 41 72% 56%`.
- `--radius: 0.9rem`.

**الخطوط:** Tajawal للعربية، Inter للإنجليزية (تُحقن عبر next/font وتُطبّق حسب `html[lang]`).

**الحركة:** Framer Motion — دخول متدرّج ناعم `ease:[0.22,1,0.36,1]`. لا حركة مبالغ بها.
احترم `prefers-reduced-motion` دائماً.

**Dark/Light Toggle:** دائرة متمدّدة عبر `document.startViewTransition` + `clipPath` (إحساس "التنفس"). موجود في `theme-toggle.tsx`.

**Toasts:** Sonner، `richColors`, `position="top-center"`, مع `dir` الصحيح.

---

## 5) قواعد ذهبية (إلزامية في كل مكان)
1. **الأرقام لاتينية (إنجليزية) دائماً** حتى داخل العربية. استخدم
   `Intl.NumberFormat('en-US', ...)` أو `numberingSystem: 'latn'`. لا تعرض أرقاماً عربية-هندية أبداً.
2. **التواريخ:** خزّن UTC في DB، اعرض بتوقيت دبي `Asia/Dubai`. صيغة عرض `dd MMM yyyy` بأرقام لاتينية.
3. **العملة:** درهم إماراتي `AED`. **VAT 5%** ثابت. احسب الضريبة على مستوى السطر ثم اجمع.
4. **FEFO** (First Expired First Out): أي اقتراح صرف/بيع يرتّب الدفعات بـ `expiry_date ASC`.
5. **الوزن:** ادعم منتجات بالوزن (kg) للملاحم — حقل `unit` = `pcs | kg`. الكميات `numeric(12,3)`.
6. **i18n:** كل نص مرئي عبر `next-intl`. لا نصوص ثابتة في JSX.
7. **Server Components افتراضياً.** `'use client'` فقط عند الحاجة لتفاعل/حركة/متصفح.
8. **التحقق بـ Zod** على الـ client و الـ server (Server Actions). لا تثق بإدخال العميل.
9. **الوصول للبيانات:** عبر Supabase مع RLS مفعّلة. لا تتجاوز RLS من العميل أبداً.
10. **أسماء الجداول/الأعمدة:** snake_case. أسماء TS: camelCase. ملفات المكونات: kebab-case.

---

## 6) Multi-Tenant + Multi-Branch (المعمارية)
- **tenant** = الشركة/المالك. **branch** = فرع تابع لـ tenant.
- كل صف بيانات تشغيلية يحمل `tenant_id` (و `branch_id` حيث يلزم).
- المستخدم يرتبط بـ tenant عبر جدول `memberships` (يحدد الدور والفرع).
- **RLS:** كل سياسة تتحقق أن `tenant_id` يخص أحد عضويات المستخدم الحالي.
- **الأدوار (roles):** `owner` > `manager` > `staff`.
  - owner: كل شيء + إدارة الفروع والمستخدمين والفوترة.
  - manager: عمليات الفرع كاملة + تقارير.
  - staff: مسح، استلام، جرد، تسجيل تالف (بدون حذف/إعدادات حساسة).

---

## 7) اصطلاحات الكود
- Server Actions في ملفات `actions.ts` بأعلى `'use server'`.
- كل Action: تحقّق Zod → تحقّق صلاحية → تنفيذ → `revalidatePath`/`revalidateTag` → إرجاع `{ ok, data?, error? }`.
- لا `any`. استخدم أنواع DB المولّدة في `src/types/database.types.ts`.
- أخطاء المستخدم بلغته عبر Sonner. أخطاء السيرفر تُسجّل ولا تُسرّب تفاصيل حسّاسة.
- كل قائمة/شبكة تحتوي: حالة تحميل (skeleton)، حالة فارغة أنيقة، حالة خطأ.

---

## 8) معايير القبول العامة لكل مرحلة (Definition of Done)
- `npm run build` ينجح بلا أخطاء TypeScript.
- يعمل بالعربية (RTL) والإنجليزية (LTR).
- يعمل بشكل ممتاز على عرض موبايل (375px).
- يدعم Dark/Light بسلاسة.
- لا أرقام عربية-هندية في أي مكان.
- لا نصوص ثابتة خارج next-intl.

---

## 9) ملاحظة لـ Claude Code
- نفّذ مرحلة واحدة فقط في كل مرة، وبالكامل.
- إذا وُجد ملف من مرحلة سابقة، عدّله بدل إعادة كتابته من الصفر ما لم يُطلب غير ذلك.
- بعد كل مرحلة: اطبع قائمة الملفات التي أنشأتها/عدّلتها + أوامر التشغيل والتحقق.
- لا تثبّت حزماً خارج المذكورة في المرحلة دون توضيح السبب.
