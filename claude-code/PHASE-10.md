# PHASE 10 — الإشعارات + Offline Sync + Animations + PWA

> الالتزام بـ `CONTEXT.md`. الهدف اللمسة الأخيرة: إشعارات ذكية، عمل بلا إنترنت ممتاز، حركات نجاح/فشل، وPWA كاملة قابلة للتثبيت.

## التثبيت
```bash
npm install @serwist/next serwist idb
```

## الملفات
```
# PWA / Service Worker
src/app/sw.ts                              (Serwist service worker)
next.config.mjs                            (دمج withSerwist + next-intl)
public/manifest.json                        (تحديث: أيقونات + shortcuts)

# Offline
src/lib/offline/db.ts                       (IndexedDB عبر idb: طابور العمليات)
src/lib/offline/queue.ts                    (enqueue/flush للعمليات المعلّقة)
src/hooks/use-online-status.ts
src/components/system/offline-banner.tsx    (شريط واضح offline/back-online)
src/components/system/sync-indicator.tsx    (مزامنة جارية / تمت)

# Notifications
src/lib/notifications/realtime.ts           (Supabase Realtime على notifications)
src/components/notifications/notification-bell.tsx
src/app/[locale]/(dashboard)/notifications/page.tsx
src/lib/notifications/sound.ts              (صوت إشعار)
supabase/migrations/0006_notifications.sql  (triggers + smart routing)

# Animations
src/components/feedback/success-burst.tsx   (نجاح)
src/components/feedback/error-shake.tsx     (فشل)
src/components/feedback/page-transition.tsx
messages: "System", "Notifications"
```

> ⚠️ **نواة المزامنة مقفولة (CORE-LOGIC.md):** طابور IndexedDB و idempotency في
> `core/src/lib/offline/db.ts` و `queue.ts`. انسخهما كما هما؛ **لا تُعد كتابة منطق الطابور.**
> مهمّتك في القسم Offline: ربط الواجهة فقط — `registerAutoFlush`, `pendingCount`,
> شريط الحالة، ومؤشّر المزامنة. أمّا تنفيذ العمليات فيتم عبر `enqueueAndRun` (مستخدم أصلاً في 7/8/9).

## المواصفات

### PWA (Serwist)
- اضبط `withSerwist({ swSrc: 'src/app/sw.ts', swDest: 'public/sw.js' })` مع الحفاظ على `withNextIntl`.
- استراتيجيات التخزين: 
  - الأصول الثابتة + الخطوط: CacheFirst.
  - صفحات App Shell: StaleWhileRevalidate.
  - استدعاءات Supabase (GET): NetworkFirst مع fallback للكاش.
- `manifest.json`: أضف `shortcuts` (مسح، استلام، جرد) وأيقونات maskable 192/512 + screenshot اختياري. تأكد من قابلية التثبيت (installable) على Android.

### Offline Sync (ممتاز كما طُلب)
- **use-online-status:** يستمع لـ `online/offline` ويختبر اتصالاً خفيفاً دورياً.
- **offline-banner:** عند فقد النت → شريط هادئ "أنت غير متصل — سيتم الحفظ محلياً". عند العودة → شريط أخضر "عاد الاتصال — جارٍ المزامنة" ثم يختفي. (رسالة واضحة عند العودة = طلب صريح).
- **queue (IndexedDB):** العمليات الكتابية الحرجة (استلام/تالف/جرد) عند عدم الاتصال تُخزَّن كـ jobs `{ id, type, payload, createdAt }`.
- **flush:** عند العودة، نفّذ الطابور بالترتيب عبر نفس Server Actions/RPC، مع إعادة محاولة + idempotency (مفتاح فريد لكل job لمنع التكرار). أظهر `sync-indicator`.
- القراءات تعمل من الكاش offline. اعرض بيانات قديمة بوسم "غير محدّث" عند اللزوم.

### الإشعارات الذكية
- **مصادر الإشعارات (triggers في 0006):**
  - `expiry_soon`: دفعات تنتهي خلال 7/30 يوم (دالة مجدولة عبر pg_cron أو فحص عند الدخول).
  - `low_stock`: عند هبوط المخزون دون `low_stock_threshold` (trigger بعد movements).
  - `receipt` / `damage` / `count`: عند العمليات.
- **التوجيه الذكي (طلب صريح: "يرسل أولاً لأول شخص متصل"):**
  - أنشئ جدول `presence` بسيط أو استخدم Supabase Realtime Presence لتتبّع المتصلين في الـ tenant/branch.
  - عند توليد إشعار تشغيلي: وجّهه أولاً لأول مستخدم متصل ضمن نفس الفرع وبدور مناسب (staff+). إن لم يوجد متصل، خزّنه لكل المخوّلين (user_id=null على مستوى الفرع) ليظهر عند أول دخول.
- **realtime.ts:** اشترك في `notifications` (insert) للمستخدم الحالي → حدّث الجرس فوراً + `sound.play()` (احترم تفضيل المستخدم/صامت) + اهتزاز.
- **notification-bell:** Badge بعدد غير المقروء (لاتيني)، قائمة منسدلة بآخر الإشعارات، "تعليم الكل كمقروء".
- **صفحة الإشعارات:** قائمة مفلترة (الكل/غير مقروء/حسب النوع)، حركة دخول، حالة فارغة أنيقة.

### Animations أنيقة (نجاح/فشل)
- **success-burst:** عند نجاح عملية (استلام/جرد/استيراد): دائرة ذهبية تتمدد + ✔ مع scale spring + beep خفيف. قصيرة (~700ms).
- **error-shake:** عند الفشل: اهتزاز أفقي خفيف + لون أحمر + رسالة. لا إزعاج.
- **page-transition:** انتقالات صفحات ناعمة (fade/slide) عبر AnimatePresence في AppShell. احترم reduced-motion في كل ما سبق.

## التحقق
- التطبيق قابل للتثبيت على Android (Add to Home Screen) ويعمل standalone.
- قطع النت: العمليات الكتابية تُحفظ وتُزامن تلقائياً عند العودة بلا تكرار.
- شريط offline يظهر، ورسالة العودة واضحة.
- إشعار جديد يصل لحظياً مع صوت/اهتزاز، والتوجيه يبدأ بأول متصل.
- حركات النجاح/الفشل أنيقة وغير مبالغ بها.
- `npm run build` ينجح. Lighthouse PWA: قابل للتثبيت.

---

## 🚀 بعد PHASE 10 — الرفع
```bash
npm run build          # تأكد من نجاحه
npm i -g vercel
vercel                 # ربط المشروع (أول مرة)
vercel --prod          # النشر
```
- أضف متغيّرات البيئة في Vercel.
- في Supabase → Auth → URL Configuration: أضف رابط Vercel (Site URL + Redirects).
- اختبر التثبيت كـ PWA من رابط الإنتاج (HTTPS).
