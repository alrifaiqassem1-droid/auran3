# AURAN — دليل البدء (اقرأني أولاً)

> نظام إدارة الملاحم والسوبر ماركت في دبي — "يرى ما لا ترى".
> هذه الحزمة مصمّمة لتُنفَّذ بالكامل عبر **Claude Code** خطوة بخطوة.

---

## فكرة سير العمل

كل مرحلة من المشروع موجودة في ملف مستقل داخل مجلد `claude-code/`:

```
claude-code/
├── PHASE-01.md   ← Setup + Landing Page
├── PHASE-02.md   ← Authentication + Roles + Multi-Tenant
├── PHASE-03.md   ← Database Schema + RLS
├── PHASE-04.md   ← Dashboard Layout + Navigation + Dark Mode
├── PHASE-05.md   ← ماسح الباركود المتقدّم
├── PHASE-06.md   ← إدارة المنتجات + Stock Batches
├── PHASE-07.md   ← استلام البضاعة + المنتجات التالفة
├── PHASE-08.md   ← الجرد السريع
├── PHASE-09.md   ← استيراد مبيعات POS
└── PHASE-10.md   ← الإشعارات + Offline Sync + Animations
```

كل ملف مرحلة هو **أمر تنفيذ كامل** موجّه لـ Claude Code:
يحتوي الهدف، الملفات المطلوبة، الكود الحرج، والمواصفات، ومعايير القبول.

### 🔒 نواة الصحّة (مهم)
مجلد `core/` + ملف `CORE-LOGIC.md` يحتويان **الكود الحرفي المقفول** للأجزاء الحسّاسة
(التسعير/VAT، FEFO، الـ RPCs الذرّية، وطابور الأوفلاين/idempotency).
هذه **لا تُولَّد** — تُنسخ حرفياً. المراحل 06→10 تستوردها بدل إعادة كتابتها.
**متى تنسخها:**
- `0010_core_rpcs.sql` → بعد تطبيق PHASE 03 مباشرةً (طبّقه على Supabase).
- ملفات `pricing.ts` / `fefo.ts` → عند PHASE 06.
- ملفات `offline/*` → عند PHASE 10 (لكنها تُستدعى من 07/08/09 عبر `enqueueAndRun`).

---

## الخطوات

### 1) جهّز البيئة (مرة واحدة)
- ثبّت Node.js 20+ و npm.
- ثبّت Claude Code:
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```
- أنشئ مجلد المشروع وافتح Claude Code بداخله:
  ```bash
  mkdir auran && cd auran
  claude
  ```

### 2) ضع ملفات السياق داخل المشروع
انسخ هذين الملفين إلى جذر مشروع `auran`:
- `CONTEXT.md`  ← دستور المشروع (يقرأه Claude في كل مرحلة)
- مجلد `claude-code/` بكامل ملفاته

### 3) نفّذ المراحل بالترتيب
في جلسة Claude Code، نفّذ **مرحلة واحدة في كل مرة** بهذا الأمر:

```
اقرأ CONTEXT.md ثم نفّذ بالكامل التعليمات في claude-code/PHASE-01.md.
أنشئ كل الملفات المطلوبة بمحتواها الكامل، ثم أخبرني بأوامر التشغيل والتحقق.
```

ثم بعد نجاح المرحلة:
```
نفّذ الآن claude-code/PHASE-02.md (مع الالتزام بـ CONTEXT.md).
```
... وهكذا حتى PHASE-10.

> 💡 نصيحة: بعد كل مرحلة، شغّل `npm run dev` وتأكّد أنها تعمل قبل الانتقال للتالية.
> لا تقفز بين المراحل — كل مرحلة تبني فوق سابقتها.

### 4) متغيّرات البيئة (قبل المرحلة 2)
أنشئ حساب Supabase مجاني، مشروع جديد، وانسخ المفاتيح إلى `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # سرّي — للسيرفر فقط
```

### 5) الرفع إلى السيرفر (بعد المرحلة 10)
الموصى به: **Vercel** (يدعم Next.js 15 أصلاً).
```bash
npm i -g vercel
vercel            # أول مرة: ربط المشروع
vercel --prod     # النشر النهائي
```
أضف نفس متغيّرات البيئة في إعدادات Vercel → Environment Variables.
وفي Supabase → Authentication → URL Configuration، أضف رابط موقعك على Vercel.

---

## ترتيب التنفيذ الموصى به للأداء
1 → 2 → 3 (مهم جداً: الـ Schema قبل أي ميزة بيانات) → 4 → 5 → 6 → 7 → 8 → 9 → 10.

بالتوفيق. كل مرحلة مكتوبة لتُنفَّذ بثقة.
