# Skill: واجهة عربية + RTL

> استخدمه قبل أي عمل على الواجهة، النصوص، أو التنسيق.

---

## الثوابت

- اللغة الافتراضية: عربي (RTL). الثانية: إنجليزي (LTR).
- كل النصوص عبر next-intl — لا نصوص ثابتة في JSX.
  الاستثناء الوحيد: /auth/onboarding (خارج next-intl routing، يستخدم ترجمات inline).
- الأرقام لاتينية دائماً — حتى في الواجهة العربية:
  Intl.NumberFormat('en-US', { numberingSystem: 'latn' })
- العملة: AED، VAT 5%.
- التواريخ: تُخزّن UTC، تُعرض بتوقيت دبي (Asia/Dubai)، صيغة dd MMM yyyy.

---

## نظام التصميم

- الألوان: أسود عميق (obsidian) + ذهبي شامبانيا
- Primary: #EF9F27 — hsl(41, 68%, 48%) فاتح / hsl(41, 72%, 56%) داكن
- الخطوط: Tajawal (عربي) + Inter (إنجليزي) — عبر next/font حسب html[lang]
- Border radius: 0.9rem

---

## قواعد الترجمة

1. أضف كل مفتاح في كلا الملفين: messages/ar.json و messages/en.json
2. ضعه في الـ namespace الصحيح:
   Auth, Nav, Dashboard, Scanner, Receiving, Damage, Products, Count, Stocktake, Reports, Settings, Roles, Notifications, System, Errors
3. لا تترك مفتاحاً في لغة دون الأخرى → يسبب نص مفقود.

---

## معايير اللغة العربية

الموقع والواجهة الرسمية: فصحى نظيفة، بدون خلط إنجليزي.
صح: "هل تريد تحسين إدارة المخزون؟"
خطأ: "هل بدك تحسّن الـ inventory؟"

رسائل الخطأ: واضحة وموجّهة لحل.
صح: "البريد الإلكتروني غير صحيح. مثال: name@email.com"
خطأ: "Validation failed: invalid email format"

تسميات الحقول: مباشرة.
صح: "اسم المتجر" · "عدد الفروع" · "اختر الخطة"
خطأ: "Merchant Name" · "Number of branches"

---

## RTL — نقاط الانتباه

- اختبر كل صفحة في الوضع العربي قبل الاعتماد.
- للنصوص المختلطة (عربي + رقم/إنجليزي): direction: auto يختار تلقائياً.
- تأكد أن الأيقونات الاتجاهية (أسهم، رجوع) تنعكس صح في RTL.
- الجداول: المحاذاة لليمين في العربية.

صح: "السعر: 299 درهم (AED) شهرياً"
خطأ: "The السعر: 299 is perfect"

---

## Checklist قبل اعتماد أي واجهة

- كل النصوص عبر next-intl (مفاتيح في ar.json + en.json)؟
- الأرقام لاتينية عبر numberingSystem: 'latn'؟
- اختبرت الصفحة في الوضع العربي (RTL)؟
- الأيقونات الاتجاهية تنعكس صح؟
- التواريخ بتوقيت دبي وصيغة dd MMM yyyy؟
- العملة AED وVAT 5% حيثما يلزم؟
- Server Component افتراضياً ('use client' فقط عند الحاجة)؟

---

آخر تحديث: يونيو 2026