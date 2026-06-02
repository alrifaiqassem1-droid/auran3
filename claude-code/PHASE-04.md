# PHASE 04 — Dashboard Layout + Navigation + Dark Mode

> الالتزام بـ `CONTEXT.md`. الهدف: قشرة لوحة تحكم أنيقة، تنقّل سفلي على الموبايل + جانبي على الشاشات الكبيرة، مبدّل فرع/لغة/ثيم، وصفحة Home بمؤشرات سريعة.

## التثبيت
```bash
npx shadcn@latest add dropdown-menu avatar sheet skeleton badge separator
```

## الملفات
```
src/app/[locale]/(dashboard)/layout.tsx        (محمي — يتحقق من الجلسة + tenant)
src/components/dashboard/app-shell.tsx
src/components/dashboard/bottom-nav.tsx         (موبايل)
src/components/dashboard/side-nav.tsx           (ديسكتوب)
src/components/dashboard/top-bar.tsx            (شعار + فرع + مستخدم)
src/components/dashboard/branch-switcher.tsx
src/components/dashboard/user-menu.tsx          (يعرض الاسم + خروج)
src/components/dashboard/nav-config.ts          (تعريف عناصر التنقّل)
src/app/[locale]/(dashboard)/dashboard/page.tsx (Home: بطاقات مؤشرات)
src/hooks/use-active-branch.ts                  (الفرع المختار — Context)
messages: أضف مفتاح "Nav" و "Dashboard"
```

## المواصفات
**التنقّل (nav-config.ts):** عناصر بأيقونات lucide:
`الرئيسية (LayoutDashboard)`, `مسح (ScanLine)`, `المنتجات (Package)`, `الاستلام (Truck)`, `الجرد (ClipboardList)`, `التالف (TriangleAlert)`, `الإشعارات (Bell)`, `الإعدادات (Settings)`.
كل عنصر: `{ key, href, icon, roles? }` — أخفِ العناصر حسب الدور.

**Layout المحمي:** في `(dashboard)/layout.tsx` (Server Component):
- `getSession()`؛ إن لم يوجد user → `redirect('/login')`.
- إن لم توجد memberships → صفحة onboarding بسيطة (إنشاء أول فرع) — أو رسالة "لا صلاحية".
- مرّر `memberships` و `user` للـ AppShell.

**AppShell (client):**
- موبايل: محتوى + **BottomNav** ثابت بأسفل الشاشة (5 عناصر رئيسية + زر "المزيد" يفتح Sheet بالبقية).
- ديسكتوب (`lg:`): **SideNav** يسار/يمين حسب dir + **TopBar** علوي.
- زر المسح في BottomNav بارز (دائرة ذهبية مرفوعة قليلاً FAB-style).
- حركة تبديل الصفحات: `AnimatePresence` + fade/slide خفيف (احترم reduced-motion).

**BranchالسSwitcher:** Dropdown يعرض فروع الـ tenant الحالي؛ الاختيار يُخزَّن في Context (`use-active-branch`) و localStorage. كل استعلامات الميزات اللاحقة تستخدم `activeBranchId`.

**TopBar/UserMenu:** الشعار "AURAN" + اسم الفرع + Avatar (حروف الاسم) → قائمة فيها: الملف، تبديل اللغة، تبديل الثيم، تسجيل الخروج (يستدعي `signOut`).

**Dashboard Home:** 4 بطاقات مؤشرات بحركة دخول متدرّجة:
`منتجات قاربت الانتهاء`, `مخزون منخفض`, `استلامات اليوم`, `تالف هذا الشهر`.
الأرقام لاتينية عبر `formatNumber`. بيانات وهمية الآن (placeholder) تُربط بالاستعلامات في المراحل اللاحقة. لكل بطاقة skeleton أثناء التحميل.

**الثيم:** أعد استخدام `theme-toggle` (دائرة متمددة). تأكد أن كل ألوان اللوحة تعمل في Dark/Light.

## التحقق
- التنقّل يعمل على موبايل (bottom) وديسكتوب (side)، RTL/LTR صحيح.
- مبدّل الفرع يغيّر السياق.
- خروج يعمل ويعيد إلى /login.
- `npm run build` ينجح.
