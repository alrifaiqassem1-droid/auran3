# PHASE 01 — Setup الأساسي + Landing Page فخمة

> الالتزام بـ `CONTEXT.md`. الهدف: مشروع يعمل بـ `npm run dev` مع i18n (عربي RTL افتراضي / إنجليزي LTR)، نظام تصميم ذهبي، تبديل ثيم بدائرة متمددة، هيكل PWA، وصفحة هبوط فخمة.

## المهمة لـ Claude Code
أنشئ كل الملفات التالية **بمحتواها الحرفي**. ثم نفّذ أوامر التثبيت. ثم اطبع تعليمات التحقق.

## الملفات
```
package.json, tsconfig.json, next.config.mjs, postcss.config.mjs,
tailwind.config.ts, components.json, src/middleware.ts,
src/i18n/{routing,request,navigation}.ts, messages/{ar,en}.json,
src/lib/utils.ts, src/components/ui/button.tsx,
src/components/{theme-provider,theme-toggle,language-switcher}.tsx,
src/app/globals.css, src/app/[locale]/{layout,page}.tsx, public/manifest.json
```

---

### === package.json ===
```json
{
  "name": "auran",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.1.6",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "next-intl": "^3.26.0",
    "next-themes": "^0.4.4",
    "framer-motion": "^11.18.0",
    "lucide-react": "^0.471.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.1",
    "sonner": "^1.7.1",
    "@radix-ui/react-slot": "^1.1.1"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "@types/node": "^22.10.7",
    "@types/react": "^19.0.7",
    "@types/react-dom": "^19.0.3",
    "tailwindcss": "^3.4.17",
    "tailwindcss-animate": "^1.0.7",
    "postcss": "^8.5.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.18.0",
    "eslint-config-next": "15.1.6"
  }
}
```

### === tsconfig.json ===
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### === next.config.mjs ===
```js
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default withNextIntl(nextConfig);
```

### === postcss.config.mjs ===
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

### === tailwind.config.ts ===
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem' },
    extend: {
      fontFamily: {
        ar: ['var(--font-tajawal)', 'system-ui', 'sans-serif'],
        en: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      keyframes: {
        'aura-breathe': { '0%,100%': { transform: 'scale(1)', opacity: '0.55' }, '50%': { transform: 'scale(1.12)', opacity: '0.85' } },
        'aura-spin': { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'aura-breathe': 'aura-breathe 7s ease-in-out infinite',
        'aura-spin': 'aura-spin 24s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
```

### === components.json ===
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "tailwind.config.ts", "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }
}
```

### === src/middleware.ts ===
```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
export default createMiddleware(routing);
export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
```

### === src/i18n/routing.ts ===
```ts
import { defineRouting } from 'next-intl/routing';
export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'as-needed',
});
export type Locale = (typeof routing.locales)[number];
```

### === src/i18n/request.ts ===
```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) locale = routing.defaultLocale;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
```

### === src/i18n/navigation.ts ===
```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

### === messages/ar.json ===
```json
{
  "Landing": {
    "tagline": "يرى ما لا ترى",
    "subtitle": "نظام ذكي لإدارة الملاحم والسوبر ماركت — تواريخ الانتهاء، الجرد، واستلام البضاعة، في مكان واحد.",
    "login": "تسجيل الدخول",
    "signup": "إنشاء حساب",
    "startFree": "ابدأ مجاناً",
    "toggleTheme": "تبديل المظهر",
    "switchLanguage": "English"
  }
}
```

### === messages/en.json ===
```json
{
  "Landing": {
    "tagline": "Sees what you don't",
    "subtitle": "A smart system for butcheries & supermarkets — expiry dates, inventory, and goods receiving, all in one place.",
    "login": "Sign in",
    "signup": "Create account",
    "startFree": "Start free",
    "toggleTheme": "Toggle theme",
    "switchLanguage": "العربية"
  }
}
```

### === src/lib/utils.ts ===
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

/** أرقام لاتينية دائماً */
export function formatNumber(n: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat('en-US', { numberingSystem: 'latn', ...opts }).format(n);
}
export function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED', numberingSystem: 'latn' }).format(n);
}
export function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai', numberingSystem: 'latn' }).format(new Date(d));
}
```

### === src/components/ui/button.tsx ===
```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:brightness-110',
        outline: 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:brightness-110',
        icon: 'border border-border bg-card/40 backdrop-blur hover:bg-accent',
      },
      size: { default: 'h-12 px-6', lg: 'h-14 px-8 text-base', sm: 'h-9 px-3', icon: 'h-11 w-11 rounded-full' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';
export { Button, buttonVariants };
```

### === src/components/theme-provider.tsx ===
```tsx
'use client';
import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

### === src/components/theme-toggle.tsx ===
```tsx
'use client';
import { useRef } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations('Landing');
  const ref = useRef<HTMLButtonElement>(null);
  const isDark = resolvedTheme === 'dark';

  const toggle = async () => {
    const next = isDark ? 'light' : 'dark';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!ref.current || !document.startViewTransition || reduce) { setTheme(next); return; }
    await document.startViewTransition(() => setTheme(next)).ready;
    const { top, left, width, height } = ref.current.getBoundingClientRect();
    const x = left + width / 2, y = top + height / 2;
    const end = Math.hypot(Math.max(left, innerWidth - left), Math.max(top, innerHeight - top));
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(0.65,0,0.35,1)', pseudoElement: '::view-transition-new(root)' }
    );
  };

  return (
    <Button ref={ref} variant="icon" size="icon" onClick={toggle} aria-label={t('toggleTheme')}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={isDark ? 'moon' : 'sun'}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25 }}>
          {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
```

### === src/components/language-switcher.tsx ===
```tsx
'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('Landing');
  const router = useRouter();
  const pathname = usePathname();
  const target = locale === 'ar' ? 'en' : 'ar';
  return (
    <Button variant="icon" onClick={() => router.replace(pathname, { locale: target })} className="h-11 w-auto gap-2 px-4">
      <Globe className="h-4 w-4" />
      <span className="text-sm font-medium">{t('switchLanguage')}</span>
    </Button>
  );
}
```

### === src/app/globals.css ===
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 40 30% 98%; --foreground: 24 10% 10%;
    --card: 40 30% 99%; --card-foreground: 24 10% 10%;
    --primary: 41 68% 48%; --primary-foreground: 40 30% 98%;
    --secondary: 40 12% 92%; --secondary-foreground: 24 10% 12%;
    --muted: 40 12% 92%; --muted-foreground: 24 6% 42%;
    --accent: 40 30% 94%; --accent-foreground: 24 10% 12%;
    --destructive: 0 72% 48%; --destructive-foreground: 40 30% 98%;
    --border: 40 12% 86%; --input: 40 12% 86%; --ring: 41 68% 48%;
    --radius: 0.9rem;
  }
  .dark {
    --background: 240 6% 4%; --foreground: 40 20% 96%;
    --card: 240 6% 7%; --card-foreground: 40 20% 96%;
    --primary: 41 72% 56%; --primary-foreground: 240 10% 6%;
    --secondary: 240 5% 12%; --secondary-foreground: 40 20% 96%;
    --muted: 240 5% 12%; --muted-foreground: 40 8% 62%;
    --accent: 240 5% 14%; --accent-foreground: 40 20% 96%;
    --destructive: 0 64% 52%; --destructive-foreground: 40 20% 96%;
    --border: 240 5% 16%; --input: 240 5% 16%; --ring: 41 72% 56%;
  }
  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; -webkit-tap-highlight-color: transparent; font-variant-numeric: lining-nums tabular-nums; }
  html[lang='ar'] body { @apply font-ar; }
  html[lang='en'] body { @apply font-en; }
}

::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 9999px; }
```

### === src/app/[locale]/layout.tsx ===
```tsx
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Tajawal, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/components/theme-provider';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const tajawal = Tajawal({ subsets: ['arabic'], weight: ['400','500','700','800'], variable: '--font-tajawal', display: 'swap' });

export const metadata: Metadata = {
  title: 'AURAN — يرى ما لا ترى',
  description: 'نظام ذكي لإدارة الملاحم والسوبر ماركت في دبي.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'AURAN' },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
  ],
};
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })); }

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${inter.variable} ${tajawal.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider messages={messages}>
            {children}
            <Toaster richColors position="top-center" dir={dir} />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### === src/app/[locale]/page.tsx ===
```tsx
'use client';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 * i, duration: 0.7, ease: [0.22,1,0.36,1] } }),
};

export default function LandingPage() {
  const t = useTranslations('Landing');
  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 animate-aura-breathe rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute inset-12 animate-aura-spin rounded-full border border-primary/20" />
        <div className="absolute inset-28 rounded-full border border-primary/10" />
      </div>
      <header className="flex items-center justify-between p-5">
        <span className="text-sm font-semibold tracking-[0.35em] text-muted-foreground">AURAN</span>
        <div className="flex items-center gap-3"><LanguageSwitcher /><ThemeToggle /></div>
      </header>
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.h1 custom={0} variants={fadeUp} initial="hidden" animate="show"
          className="bg-gradient-to-b from-foreground via-foreground to-primary bg-clip-text text-6xl font-extrabold tracking-tight text-transparent sm:text-7xl">AURAN</motion.h1>
        <motion.p custom={1} variants={fadeUp} initial="hidden" animate="show" className="mt-6 text-2xl font-bold text-primary sm:text-3xl">{t('tagline')}</motion.p>
        <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show" className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">{t('subtitle')}</motion.p>
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-12 flex w-full max-w-xs flex-col gap-3">
          <Button size="lg" className="w-full">{t('startFree')}</Button>
          <Button size="lg" variant="outline" className="w-full">{t('login')}</Button>
          <Button size="lg" variant="ghost" className="w-full">{t('signup')}</Button>
        </motion.div>
      </section>
      <footer className="pb-6 text-center text-xs text-muted-foreground">AURAN © 2026 · Dubai</footer>
    </main>
  );
}
```

### === public/manifest.json ===
```json
{
  "name": "AURAN", "short_name": "AURAN",
  "description": "يرى ما لا ترى — إدارة الملاحم والسوبر ماركت",
  "start_url": "/", "display": "standalone", "orientation": "portrait",
  "background_color": "#0a0a0b", "theme_color": "#0a0a0b",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## أوامر التثبيت
```bash
npm install
```
> ملاحظة: أضف أيقونتين مؤقتتين في `public/icon-192.png` و `public/icon-512.png` (أي صورة الآن).

## التحقق (Definition of Done)
```bash
npm run dev    # افتح http://localhost:3000  (عربي) و /en (إنجليزي)
npm run build  # يجب أن ينجح بلا أخطاء
```
- ✅ تبديل الثيم يُظهر دائرة متمددة.
- ✅ زر اللغة يبدّل RTL/LTR.
- ✅ يعمل بشكل ممتاز على 375px.
