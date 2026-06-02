# PHASE 05 — ماسح الباركود المتقدّم

> الالتزام بـ `CONTEXT.md`. الهدف: ماسح كاميرا سريع وأنيق، وضعان (مستمر / عند الضغط)، صوت beep، auto-focus/zoom.

## التثبيت
```bash
npm install html5-qrcode
```
> أضف صوت قصير: `public/sounds/beep.mp3` (نغمة قصيرة ~150ms).

## الملفات
```
src/hooks/use-barcode-scanner.ts     (تغليف html5-qrcode)
src/hooks/use-beep.ts                 (Web Audio: beep فوري بلا تأخير)
src/components/scanner/scanner-view.tsx
src/components/scanner/scan-overlay.tsx     (إطار + خط ليزر متحرك)
src/components/scanner/scan-result-sheet.tsx (يظهر المنتج الممسوح)
src/app/[locale]/(dashboard)/scan/page.tsx
src/lib/scan/lookup-product.ts        (بحث بالباركود في products)
messages: "Scanner"
```

## المواصفات
**use-beep.ts:** استخدم `AudioContext` لتوليد beep فوري (أوثق من <audio> على الموبايل). دالة `beep()` + خيار اهتزاز `navigator.vibrate?.(40)`. أنشئ/استأنف AudioContext عند أول تفاعل مستخدم (سياسة autoplay).

**use-barcode-scanner.ts:** غلّف `Html5Qrcode`:
- إعدادات: `fps: 15`, `qrbox` ديناميكي (نسبة من العرض)، `aspectRatio`, `formatsToSupport` تشمل EAN-13/EAN-8/UPC/CODE-128.
- فضّل الكاميرا الخلفية `facingMode: 'environment'`.
- فعّل `focusMode: 'continuous'` و `advanced: [{ zoom }]` عبر `applyConstraints` إن دعمها الجهاز (try/catch).
- نظّف (stop) عند unmount.
- مرّر callbacks: `onScan(text)`, `onError`.

**وضعان (طلب صريح):**
1. **مسح مستمر:** يطلق `onScan` تلقائياً عند أي قراءة ناجحة، مع **debounce** لنفس الكود (تجاهل تكرار خلال ~1200ms) لتفادي مسح متكرر.
2. **مسح عند الضغط:** زر "مسح" كبير؛ يلتقط القراءة الحالية مرة واحدة عند الضغط.
زر تبديل بين الوضعين في الأعلى (Segmented/Toggle).

**عند نجاح المسح:**
- `beep()` + اهتزاز + ومضة نجاح خضراء خفيفة على الإطار (Framer Motion).
- `lookup-product(barcode, tenantId)`:
  - وُجد → افتح `scan-result-sheet` بمعلومات المنتج + أزرار سياق (استلام/تالف/تفاصيل — تُفعّل في مراحلها).
  - لم يوجد → toast "منتج غير معروف" + زر "إضافة منتج جديد بهذا الباركود" (يربط بـ PHASE 06).

**التصميم:**
- شاشة كاميرا full-bleed، overlay داكن مع نافذة شفافة مركزية، خط ليزر ذهبي متحرك (animation).
- زر تبديل الكاميرا الأمامية/الخلفية، زر تكبير (+/−)، مؤشر حالة "جاهز للمسح".
- أذونات: عند الرفض، حالة فارغة أنيقة + زر "إعادة المحاولة" + شرح تفعيل الإذن.

**الأداء:** ابدأ/أوقف الكاميرا فقط عند فتح/إغلاق الصفحة. لا تعيد إنشاء الماسح بلا داعٍ.

## التحقق
- المسح المستمر يقرأ بسرعة ويصدر beep واحد لكل كود (لا تكرار).
- وضع الضغط يعمل.
- اللوكب يفتح الـ sheet بالمنتج أو يعرض "غير معروف".
- يعمل على موبايل حقيقي (HTTPS مطلوب للكاميرا — على localhost مسموح).
