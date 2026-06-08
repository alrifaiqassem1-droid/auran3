# AURAN — Master Development Context

> Read this file completely before starting any work.
> Last updated: 2026-06-05 — reflects full codebase as-built.

---

## 1. Project Overview

**AURAN** ("يرى ما لا ترى" — Sees what you don't) is an Arabic-first PWA for inventory management targeting grocery stores, supermarkets, and butcheries in Dubai/Gulf.

**Core features:** FEFO expiry tracking, fast barcode scanning, goods receiving, damaged goods logging, stocktake/count, POS import, multi-branch, multi-role.

| Item | Value |
|---|---|
| Live URL | https://auran.vercel.app |
| Supabase Project ID | `jqdmfbpmarxjpjcvmnvz` |
| Supabase Dashboard | https://supabase.com/dashboard/project/jqdmfbpmarxjpjcvmnvz |
| Git branch | `master` (main for PRs) |
| Deployment | Vercel (auto-deploy off master) |

**Tech stack:**
- Next.js 15.5 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 3.4 + shadcn/ui (new-york style) + Framer Motion 11
- Supabase (PostgreSQL + Auth + RLS + Realtime) + `@supabase/ssr`
- next-intl v3 — Arabic RTL (default) + English LTR
- Serwist (PWA / Service Worker)
- html5-qrcode (barcode scanner)
- Sonner (toasts) + Zod + React Hook Form + lucide-react
- idb (IndexedDB for offline queue)

**Design system:**
- Palette: deep obsidian black + champagne gold
- Primary color: `hsl(41, 68%, 48%)` light / `hsl(41, 72%, 56%)` dark — `#EF9F27`
- Fonts: Tajawal (Arabic), Inter (English) — injected via next/font, applied by `html[lang]`
- Border radius: `0.9rem`
- Numbers: **always Latin digits** (`Intl.NumberFormat('en-US', { numberingSystem: 'latn' })`)
- Currency: AED, VAT 5%
- Dates: store UTC, display Dubai time (`Asia/Dubai`), format `dd MMM yyyy`

---

## 2. Database Schema

All tables are in `public` schema with RLS enabled. Every operational row carries `tenant_id`.

### `tenants`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | auto |
| name | text | company/store name |
| trn | text? | Tax Registration Number |
| vat_rate | numeric | default 5 (%) |
| created_at | timestamptz | |

### `branches`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| name | text | |
| address | text? | |
| is_default | boolean | |
| created_at | timestamptz | |

### `profiles`
Mirrors `auth.users` — auto-populated via trigger or bootstrap_tenant.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = auth.users.id |
| full_name | text? | |
| phone | text? | |
| created_at | timestamptz | |

### `memberships`
Links a user to a tenant with a role (and optional branch scope and custom role).
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| user_id | uuid FK→profiles | |
| role | user_role enum | owner / manager / staff |
| custom_role_id | uuid? FK→custom_roles | nullable |
| branch_id | uuid? FK→branches | nullable (future branch scoping) |
| created_at | timestamptz | |

### `custom_roles`
Granular permission sets created by owners.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| name | text | display name |
| permissions | jsonb | RolePermissions object (see §4) |
| created_at | timestamptz | |

### `invitations`
Pending staff invites. Token is DB-generated UUID.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| email | text | lowercased |
| token | uuid | DB default gen_random_uuid() |
| default_role | user_role enum | manager / staff |
| custom_role_id | uuid? FK→custom_roles | |
| invited_by | uuid? | auth.users.id of sender |
| accepted_at | timestamptz? | null = pending |
| expires_at | timestamptz | DB default (7 days) |
| created_at | timestamptz | |

### `products`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| category_id | uuid? FK→categories | |
| name | text | |
| barcode | text? | EAN-13 / any |
| cost_price | numeric | |
| sell_price | numeric | |
| unit | product_unit enum | pcs / kg |
| vat_inclusive | boolean | is sell_price VAT-inclusive? |
| is_active | boolean | |
| low_stock_threshold | numeric | for notifications |
| created_at | timestamptz | |

### `categories`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| name | text | |
| created_at | timestamptz | |

### `suppliers`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| name | text | |
| phone | text? | |
| created_at | timestamptz | |

### `stock_batches`
One batch = one delivery of one product with a specific expiry. FEFO operates on this table.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| branch_id | uuid FK→branches | |
| product_id | uuid FK→products | |
| quantity | numeric | current remaining qty |
| cost_price | numeric | per unit at time of receipt |
| expiry_date | date? | null = no expiry |
| received_at | timestamptz | used as FEFO tiebreaker |
| created_at | timestamptz | |

### `stock_movements`
Immutable audit log of every quantity change.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| branch_id | uuid FK→branches | |
| product_id | uuid FK→products | |
| batch_id | uuid? FK→stock_batches | |
| type | movement_type enum | receipt / sale / damage / adjustment / count |
| quantity | numeric | positive=in, negative=out |
| reference_id | uuid? | FK to source (receipt, damage, count) |
| created_by | uuid? | auth.users.id |
| created_at | timestamptz | |

### `goods_receipts`
Header record for a receiving session.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| branch_id | uuid FK→branches | |
| supplier_id | uuid? FK→suppliers | |
| reference | text? | PO/invoice number |
| total_cost | numeric | |
| created_by | uuid? | |
| created_at | timestamptz | |

### `goods_receipt_items`
Line items for a receipt.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| receipt_id | uuid FK→goods_receipts | |
| product_id | uuid FK→products | |
| batch_id | uuid? FK→stock_batches | created batch |
| quantity | numeric | |
| cost_price | numeric | |
| expiry_date | date? | |

### `damaged_products`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| branch_id | uuid FK→branches | |
| product_id | uuid FK→products | |
| batch_id | uuid? FK→stock_batches | FEFO-selected batch |
| quantity | numeric | |
| reason | damage_reason enum | expired / broken / spoiled / other |
| note | text? | |
| created_by | uuid? | |
| created_at | timestamptz | |

### `inventory_counts`
A stocktake session.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| branch_id | uuid FK→branches | |
| status | text | open / closed |
| created_by | uuid? | |
| closed_at | timestamptz? | |
| created_at | timestamptz | |

### `inventory_count_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| count_id | uuid FK→inventory_counts | |
| product_id | uuid FK→products | |
| expected_qty | numeric | system qty at count open |
| counted_qty | numeric | physically counted |
| created_at | timestamptz | |

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| branch_id | uuid? FK→branches | |
| user_id | uuid? | null = broadcast to branch |
| title | text | |
| body | text? | |
| type | notification_type enum | expiry_soon / low_stock / receipt / damage / count / system |
| is_read | boolean | |
| created_at | timestamptz | |

### `pos_imports`
Header for a POS sales file import.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| branch_id | uuid FK→branches | |
| source | text | 'excel', 'csv', etc. |
| file_name | text? | |
| rows_count | numeric | |
| created_by | uuid? | |
| created_at | timestamptz | |

### `pos_import_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| import_id | uuid FK→pos_imports | |
| product_id | uuid? FK→products | null if barcode not found |
| barcode | text? | |
| quantity | numeric | |
| total | numeric | |
| sold_at | timestamptz? | |

### `processed_ops`
Idempotency table — prevents duplicate RPC execution on retry.
| Column | Type | Notes |
|---|---|---|
| client_op_id | uuid PK | generated client-side |
| tenant_id | uuid FK→tenants | |
| user_id | uuid | |
| op_type | text | receive_goods / record_damage / etc. |
| result | jsonb | cached result |
| created_at | timestamptz | |

### Database Enums
```
user_role:         owner | manager | staff
damage_reason:     expired | broken | spoiled | other
movement_type:     receipt | sale | damage | adjustment | count
notification_type: expiry_soon | low_stock | receipt | damage | count | system
product_unit:      pcs | kg
```

### Database Functions (RPCs)
| Function | Purpose |
|---|---|
| `bootstrap_tenant(p_company, p_full_name, p_user_id)` | Creates tenant + default branch + profile + owner membership |
| `auth_tenant_ids()` | Returns current user's tenant IDs (used for RLS scope) |
| `has_role(p_roles[], p_tenant)` | Boolean role check |
| `_guard(p_roles[], p_tenant)` | Raises exception if role check fails (used inside other RPCs) |
| `receive_goods(p_payload jsonb)` | Atomic receipt: creates receipt + batches + movements |
| `record_damage(p_payload jsonb)` | Atomic damage: deducts from FEFO batches + creates record |
| `close_count(p_payload jsonb)` | Atomic stocktake close: applies adjustments |
| `apply_pos_import(p_payload jsonb)` | Atomic POS import: deducts sold stock |

All four write RPCs use `processed_ops` for idempotency — replaying the same `client_op_id` returns the cached result without re-executing.

### Migration Files (supabase/migrations/)
```
0001_init.sql             — base schema: tables, RLS, bootstrap_tenant
0003_security.sql         — rate limiting, audit log, hCaptcha support
0004_count.sql            — inventory_counts + items
0005_pos.sql              — pos_imports + items
0006_notifications.sql    — notifications table + triggers
0007_roles.sql            — custom_roles + invitations tables
0009_fix_audit_trigger.sql — audit trigger fix (to_jsonb pattern)
0010_core_rpcs.sql        — atomic RPCs: receive_goods, record_damage, close_count, apply_pos_import
0011_fix_audit_trigger.sql — follow-up audit trigger fix
0012_goods_receipts_status.sql — goods_receipts status column
```

**Note:** `0008_hardening.sql` is referenced but NOT yet applied — it contains security hardening rules.

---

## 3. Auth System

### Sign-up flow (email)
1. User fills signup form (email, password, full name, company) + hCaptcha
2. `signUp()` server action: Zod validation → rate limit (3/hour per IP) → `supabase.auth.signUp()` with `emailRedirectTo: SITE_URL/auth/confirm`
3. Supabase sends confirmation email → user clicks link → `/auth/confirm?token_hash=...&type=signup`
4. `confirm/route.ts`: `verifyOtp()` → calls `bootstrap_tenant(p_company, p_full_name, p_user_id)` → redirects to `/dashboard?celebration=true`

### Sign-up flow (Google OAuth)
1. User clicks Google button → `signInWithOAuth({ provider: 'google', options: { redirectTo: origin/auth/callback } })`
2. Google redirects to `/auth/callback?code=xxx`
3. `callback/route.ts`: `exchangeCodeForSession()` → checks if membership exists → routes to `/dashboard` (existing user) or `/auth/onboarding` (new user)
4. `/auth/onboarding`: asks for company name + password (5-attempt retry for cookie propagation) → calls `bootstrap_tenant()` → redirects to `/dashboard`

### Key: cookie propagation pattern
In `auth/callback/route.ts`, session cookies must be written to BOTH the interim response AND the final redirect response:
```typescript
let response = NextResponse.redirect(`${origin}/dashboard`);
// ... exchangeCodeForSession writes to response.cookies ...
const finalResponse = NextResponse.redirect(`${origin}${destination}`);
response.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));  // ← critical
return finalResponse;
```

### bootstrap_tenant RPC
**Critical:** Must pass `p_user_id` explicitly — the function does NOT use `auth.uid()` internally (it's called in server context where the session may not be active).
```typescript
await supabase.rpc('bootstrap_tenant', {
  p_company:   companyName,
  p_full_name: fullName,
  p_user_id:   user.id,   // ← must be explicit
});
```

### Session management
- `lib/auth/get-session.ts` — server-side, cached with React `cache()`. Calls `getUser()` (server-validated) + fetches memberships with tenant names.
- `lib/supabase/middleware.ts` — `updateSession()` refreshes the session cookie on every request for protected routes.
- `hooks/use-session-timeout.ts` — client-side idle timeout: 30 min inactivity → auto sign-out. Tracks user events (click, keydown, scroll, mousemove, touchstart).

### Sign-out
Three entry points:
1. **`UserMenu` dropdown** (TopBar) — calls `signOut()` server action (includes audit log)
2. **`SignOutButton`** (SideNav bottom + BottomNav More sheet) — calls `supabase.auth.signOut()` client-side + `window.location.replace('/login')`
3. **Session timeout** (`use-session-timeout.ts`) — auto sign-out after 30 min idle

### Auth audit log
`lib/auth/audit-log.ts` logs to `auth_audit_log` table via admin client.
Events: `login`, `signup`, `logout`, `failed_login`, `email_verified`, `blocked_attempt`.
Fire-and-forget — never throws. Also: `lib/audit.ts` logs operational events (invite, role_change, receive, damage, etc.) to a different table.

### Rate limiting
`lib/auth/rate-limit.ts`:
- Login: 5 failed attempts / 30 min per email → account lock
- Login: 10 attempts / 30 min per IP → IP block
- Signup: 3 attempts / hour per IP

**Supabase free tier email rate limit: 2–3 emails/hour.** For production, connect Resend via Supabase SMTP settings.

---

## 4. Roles & Permissions

### Built-in roles (Postgres enum `user_role`)
| Role | Access |
|---|---|
| `owner` | Everything: settings, roles management, staff removal, all reports |
| `manager` | Operations + reports + import + barcode generator + settings view |
| `staff` | Scan, receiving, count, damage, expiry, products, notifications |

### Custom roles
Stored in `custom_roles.permissions` (JSONB). Shape:
```typescript
interface RolePermissions {
  products:  { view: boolean; add: boolean; edit: boolean; delete: boolean };
  receiving: { view: boolean; add: boolean };
  inventory: { view: boolean; add: boolean };
  damage:    { view: boolean; add: boolean };
  reports:   { view: boolean };
  prices:    { view: boolean };
  staff:     { view: boolean; add: boolean; edit: boolean; delete: boolean };
}
```
Custom roles are assigned via `memberships.custom_role_id` alongside the base `role`. The base role controls nav visibility; custom roles are for fine-grained UI control (future enforcement).

### Permission check layers (6 total)
1. **Middleware** (`src/middleware.ts`) — coarse: unauthenticated → `/login`; auth-only pages (login/signup) + authenticated → `/dashboard`
2. **Dashboard layout** (`(dashboard)/layout.tsx`) — `getSession()` → `memberships.length === 0` → "No Permission" screen
3. **Nav filtering** (`nav-config.ts`) — `navItems` has `roles?: UserRole[]`; filtered before rendering in SideNav/BottomNav
4. **Page-level guard** (e.g. `settings/roles/page.tsx`) — server component checks `membership.role !== 'owner'` → `redirect('/dashboard')`
5. **Server action guard** (`getOwnerContext()` in `roles/actions.ts`) — re-verifies owner role server-side on every mutation
6. **DB functions** — `_guard(p_roles[], p_tenant)` raises exception inside RPCs if caller lacks required role

---

## 5. Invitation System

**Fully implemented.** Tables: `invitations`, `custom_roles`.

### Flow
1. Owner opens `/dashboard/settings/roles` → Staff tab → "Invite Staff" button
2. Enters email + selects base role (manager/staff) + optional custom role
3. `sendInvitation(email, defaultRole, customRoleId)` server action:
   - Deletes any existing pending invite for that email
   - Inserts new row → DB generates `token` (UUID)
   - Returns token to client
4. Client constructs link: `${origin}/join?token=${token}` — copy to clipboard
5. Employee opens link → `/join?token=xxx` page → `JoinClient` component
6. `acceptInvitation(token)` server action:
   - Validates token exists + `accepted_at IS NULL` + not expired
   - Creates `memberships` row (role + custom_role_id from invitation)
   - Marks `accepted_at = NOW()`
   - Employee lands on `/dashboard`

### Server actions (`settings/roles/actions.ts`)
| Action | Gate | What it does |
|---|---|---|
| `getRolesAndStaff()` | tenant member | Loads custom_roles + staff list (with emails via admin API) + pending invitations |
| `createRole(name, permissions)` | owner | Inserts to custom_roles |
| `updateRole(id, name, permissions)` | owner | Updates custom_roles |
| `deleteRole(id)` | owner | Deletes custom_roles row |
| `updateMemberRole(membershipId, customRoleId, defaultRole)` | owner | Updates memberships |
| `removeMember(membershipId)` | owner | Deletes membership (DB trigger prevents removing last owner) |
| `sendInvitation(email, defaultRole, customRoleId)` | owner | Creates invitation, returns token |
| `cancelInvitation(invitationId)` | owner | Hard-deletes invitation |
| `acceptInvitation(token)` | logged-in user | Accepts invite, creates membership |

**Note:** `invitations` and `custom_roles` are NOT in `database.types.ts` auto-generation scope (new tables). They were manually added to `src/types/database.types.ts` and are fully typed.

---

## 6. Key Architectural Decisions

### LOCKED FILES — never touch
```
src/components/scanner/scanner-layout.tsx
src/hooks/use-barcode-scanner.ts
```
These contain the barcode scanner implementation. Any change risks breaking the camera feed on all scanner pages.

### Core logic files — frozen (copy-paste originals, never regenerate)
```
src/lib/pricing.ts          — VAT arithmetic, AED formatting
src/lib/stock/fefo.ts       — FEFO sort/allocate, expiry status
src/lib/offline/db.ts       — IndexedDB schema via idb
src/lib/offline/queue.ts    — enqueueAndRun, flushQueue, registerAutoFlush
supabase/migrations/0010_core_rpcs.sql  — atomic Postgres RPCs
```
These are hand-verified and must match each other exactly (FEFO order in TypeScript = FEFO order in SQL).

### Offline queue pattern
All write operations go through `enqueueAndRun(type, payload)`:
1. Generates `client_op_id` (UUID)
2. Stores job in IndexedDB
3. If online: executes RPC immediately, deletes job on success
4. If offline or error: leaves job in queue
5. `registerAutoFlush()` — wired in AppShell — re-runs queue when `online` event fires
6. Server-side idempotency: `processed_ops` table prevents double-execution on retry

Usage pattern:
```typescript
const res = await enqueueAndRun('receive_goods', { branch_id, lines: [...] });
if (res.ok && !res.queued) showSuccess();
else if (res.ok && res.queued) showSavedOffline();
else showError(res.error);
```

### Service Worker (Serwist)
- `src/app/sw.ts` → compiled to `public/sw.js` at build time
- Bypass paths (never cached): `/auth/*`, `/login`, `/signup`, `/verify-email`, `/join`
- Supabase REST/storage: `NetworkFirst` (GET only — POST auth calls must not be intercepted)
- Static assets / fonts: `CacheFirst`
- Navigation (HTML): `StaleWhileRevalidate` (excluding auth paths)
- Push notification handler + notification click handler included

### i18n routing
- Default locale: `ar` (RTL). Second locale: `en` (LTR).
- URLs: `/{locale}/dashboard`, `/{locale}/login`, etc.
- Auth routes (`/auth/*`) are OUTSIDE the locale routing — they use `NextResponse.next()` bypass in middleware.
- Onboarding page (`/auth/onboarding`) uses inline translations (no next-intl context available at that path).

### Multi-tenant data isolation
- Every table has `tenant_id`; Postgres RLS uses `auth_tenant_ids()` to verify access.
- Client code never passes `tenant_id` directly — always derived from authenticated session.
- `getOwnerContext()` re-verifies ownership server-side on every mutation action.

### Expiry monitoring
- `lib/notifications/morning-check.ts` runs at app open and at 6 AM (scheduled via `setTimeout`)
- Throttled: once per 6 hours (`localStorage: auran_last_expiry_check`)
- Queries `stock_batches` for items expiring within 30 days → shows browser notifications (via SW)

### Branch switcher
- `hooks/use-active-branch.tsx` — React context storing `activeBranchId`
- `BranchSwitcher` component in TopBar — updates active branch
- Scanner pages use `href` (hard navigation) not `Link` to reinitialize camera on branch change

---

## 7. Known Issues & Fixes Applied

| Issue | Fix Applied | Where |
|---|---|---|
| Google OAuth lands on `/en?code=xxx` instead of callback | `redirectTo: origin/auth/callback` | `google-button.tsx` |
| OAuth session cookies not propagating to final redirect | Copy cookies from interim to final `NextResponse` | `auth/callback/route.ts` |
| Onboarding page bounces to `/login` before cookies settle | 5-attempt retry loop (500ms apart) before giving up | `auth/onboarding/page.tsx` |
| `bootstrap_tenant` called without user id on Google flow | Pass `p_user_id` explicitly (not relying on `auth.uid()`) | `auth/confirm/route.ts`, `onboarding/page.tsx` |
| `database.types.ts` was UTF-16 LE causing tsc to fail after Write | Re-saved as UTF-8 without BOM | `src/types/database.types.ts` |
| `invitations` and `custom_roles` tables missing from TypeScript types | Manually added to `database.types.ts` | `src/types/database.types.ts` |
| SW intercepting Supabase auth POSTs → `cache.put()` rejects | Matcher limited to GET only + bypass path regex | `src/app/sw.ts` |
| Audit trigger failing | Separate migrations 0009 + 0011 applied | Supabase SQL editor |
| Session timeout too aggressive | 30 min idle, checks every 1 min | `use-session-timeout.ts` |

### Supabase free tier constraints
- **Email rate limit:** 2–3 emails/hour on free plan. Fix: connect Resend via Supabase Auth SMTP.
- **Edge Functions:** not used (all logic in Next.js server actions).
- **Storage:** not used yet.

### Google OAuth setup checklist
1. Supabase Dashboard → Auth → Providers → Google: enable, paste Client ID + Client Secret
2. Google Cloud Console → OAuth Credentials → Authorized redirect URIs: `https://jqdmfbpmarxjpjcvmnvz.supabase.co/auth/v1/callback`
3. Supabase Dashboard → Auth → URL Configuration → Site URL: `https://auran.vercel.app`
4. Supabase → Auth → URL Configuration → Redirect URLs: add `https://auran.vercel.app/auth/callback`
5. In `.env.local` / Vercel env: `NEXT_PUBLIC_SITE_URL=https://auran.vercel.app`

---

## 8. File Map

### App routes
```
src/app/
├── auth/                         Standalone (no locale prefix — bypass middleware)
│   ├── callback/route.ts         OAuth code exchange → session → route to dashboard/onboarding
│   ├── confirm/route.ts          Email OTP verify → bootstrap_tenant → /dashboard
│   ├── error/page.tsx            Auth error display
│   └── onboarding/page.tsx       Google new-user: company + password → bootstrap_tenant
│
└── [locale]/
    ├── layout.tsx                Root locale layout (fonts, theme, direction)
    ├── page.tsx                  / → redirects to /{locale}/login
    ├── (auth)/
    │   ├── layout.tsx            Auth card wrapper
    │   ├── actions.ts            signIn / signUp / signOut server actions (+ rate limit + audit)
    │   ├── login/page.tsx        Email+password + Google sign-in
    │   ├── signup/page.tsx       Email signup + hCaptcha + password strength
    │   └── verify-email/page.tsx "Check your inbox" screen
    ├── (dashboard)/
    │   ├── layout.tsx            getSession() → AppShell (guards all dashboard routes)
    │   └── dashboard/
    │       ├── page.tsx          KPI dashboard (expiring soon, low stock, today receipts, damage)
    │       ├── scan/             Barcode scan page
    │       ├── receiving/        Goods receiving cart + scanner
    │       ├── count/            Inventory count session list
    │       ├── count/[id]/       Active count session
    │       ├── stocktake/        Stocktake overview
    │       ├── damage/           Record damaged goods
    │       ├── damaged/          Damaged goods history
    │       ├── expiry/           Expiry tracker (batches sorted by expiry)
    │       ├── products/         Product list + CRUD
    │       ├── products/[id]/    Product detail + batch history
    │       ├── import/           POS CSV/Excel import wizard
    │       ├── reports/          VAT + damage + expiry reports
    │       ├── reports/audit/    Audit log viewer (owner only)
    │       ├── notifications/    Notification list
    │       ├── barcode-generator/ Barcode label printer
    │       ├── settings/         Profile + company + password
    │       └── settings/roles/   Custom roles + staff list + invitations (owner only)
    └── join/                     Invitation acceptance landing (/join?token=xxx)
```

### Key components
```
src/components/
├── dashboard/
│   ├── app-shell.tsx             Layout shell: TopBar + SideNav + main + BottomNav + providers
│   ├── top-bar.tsx               TopBar: theme + language + branch selector + user menu
│   ├── side-nav.tsx              Desktop sidebar (md+): nav items + sign-out button
│   ├── bottom-nav.tsx            Mobile bottom bar: primary 4 + FAB + More sheet
│   ├── nav-config.ts             navItems array with keys, hrefs, icons, role restrictions
│   ├── branch-switcher.tsx       Branch dropdown in TopBar
│   ├── user-menu.tsx             Avatar dropdown: name + email + sign out (server action)
│   └── sign-out-button.tsx       Reusable sign-out button (client-side signOut)
├── settings/
│   ├── settings-client.tsx       Profile + company + password settings form
│   └── roles-client.tsx          Custom roles + staff management + invite dialog
├── scanner/
│   ├── scanner-layout.tsx        ⛔ LOCKED — camera + scanning UI
│   └── (scanner components)
├── auth/
│   ├── google-button.tsx         Google OAuth trigger button
│   ├── hcaptcha-widget.tsx       hCaptcha widget
│   └── password-strength.tsx     Password strength indicator
└── system/
    ├── offline-banner.tsx        Online/offline status banner
    ├── expiry-alert.tsx          Morning expiry check alert
    └── error-boundary.tsx        React error boundary
```

### Key library files
```
src/lib/
├── pricing.ts                    ⛔ LOCKED — VAT math, AED format, line/sum breakdowns
├── utils.ts                      cn() classname utility
├── audit.ts                      logAudit() for operational events
├── auth/
│   ├── get-session.ts            getSession() — server, cached, returns user + memberships
│   ├── audit-log.ts              logAuditEvent() — auth events (login/logout/etc.)
│   ├── rate-limit.ts             checkRateLimit(), recordAttempt()
│   └── get-client-info.ts        IP + User-Agent extraction for audit
├── supabase/
│   ├── client.ts                 createClient() — browser
│   ├── server.ts                 createClient() — server (async, cookie-aware)
│   ├── admin.ts                  createAdminClient() — service role (server only)
│   └── middleware.ts             updateSession() — refreshes session in middleware
├── stock/
│   └── fefo.ts                   ⛔ LOCKED — sortFefo, allocateFefo, expiryStatus
├── offline/
│   ├── db.ts                     ⛔ LOCKED — IndexedDB schema
│   └── queue.ts                  ⛔ LOCKED — enqueueAndRun, flushQueue, registerAutoFlush
├── notifications/
│   ├── morning-check.ts          Expiry check on app open (throttled 6h)
│   ├── realtime.ts               Supabase Realtime subscription for notifications
│   └── sound.ts                  Beep/notification sounds
├── validators/
│   ├── auth.ts                   loginSchema, signupSchema (Zod)
│   ├── product.ts                productSchema
│   ├── receiving.ts              receivingSchema
│   ├── damage.ts                 damageSchema
│   ├── count.ts                  countSchema
│   └── pos.ts                    posImportSchema
└── pos/
    ├── adapters/                 POS system CSV/Excel adapters
    ├── engine.ts                 Import processing engine
    └── parse-csv.ts              CSV parsing
```

### Types
```
src/types/
├── database.types.ts     Full Supabase schema (UTF-8, manually maintained)
└── db.ts                 Convenience re-exports:
                          Product, StockBatch, Branch, Tenant, Membership, Category,
                          Supplier, GoodsReceipt, DamagedProduct, InventoryCount,
                          Notification, Invitation, CustomRole,
                          UserRole, ProductUnit, MovementType, DamageReason
```

### Translations
```
messages/
├── ar.json   Arabic (RTL) — default locale
└── en.json   English (LTR)

Namespaces: Auth, Nav, Dashboard, Scanner, Receiving, Damage, Products,
            Count, Stocktake, Reports, Settings, Roles, Notifications,
            System, Errors
```

---

## 9. Development Rules

1. **Read this file first** before starting any session or task.
2. **One issue at a time.** Explain the approach before implementing.
3. **Never touch** `scanner-layout.tsx` or `use-barcode-scanner.ts`.
4. **Never touch** the locked core files (`pricing.ts`, `fefo.ts`, `offline/db.ts`, `offline/queue.ts`) without flagging the impact first.
5. **Test on the production URL** `https://auran.vercel.app` — not preview URLs. Preview deployments have the same env vars but OAuth redirects are configured for production only.
6. **Supabase SQL changes** go through the Supabase SQL Editor (or a new migration file) — not Vercel, not code.
7. **TypeScript strict.** No `as any` — use `as unknown as T` for deliberate type assertions.
8. **Arabic numbers forbidden.** Use `Intl.NumberFormat('en-US', { numberingSystem: 'latn' })` everywhere.
9. **Server Components by default.** Add `'use client'` only when the component needs browser APIs, event handlers, or React state.
10. **All text through next-intl.** No hard-coded strings in JSX (except the locked `onboarding/page.tsx` which has inline translations because it's outside next-intl routing).
11. **Deploy command:** `git add . && git commit -m "..." && npx vercel --prod`
12. **After Supabase schema changes**, regenerate `database.types.ts`:
    ```
    npx supabase gen types typescript --project-id jqdmfbpmarxjpjcvmnvz > src/types/database.types.ts
    ```
    Then convert to UTF-8 (the CLI may output UTF-16 LE without BOM):
    ```powershell
    $c = [IO.File]::ReadAllText('src/types/database.types.ts', [Text.Encoding]::Unicode)
    [IO.File]::WriteAllText('src/types/database.types.ts', $c, (New-Object Text.UTF8Encoding $false))
    ```
    If the CLI is unavailable, manually add new tables following the existing pattern in `database.types.ts`.

---

## 10. Pending Tasks

| Priority | Task | Notes |
|---|---|---|
| HIGH | Connect Resend for transactional email | Bypasses Supabase free tier 3 emails/hour limit. Supabase → Auth → SMTP settings |
| HIGH | Apply `0008_hardening.sql` migration | Security hardening — has not been applied to Supabase yet |
| HIGH | Test full Google OAuth → onboarding flow | New users only. Ensure `bootstrap_tenant` runs, redirect to `/dashboard` works |
| MEDIUM | Fix audit trigger (`to_jsonb` pattern) | Migrations 0009 + 0011 attempted fixes; verify in production |
| MEDIUM | RTL alignment audit | Check all pages in Arabic mode for mis-aligned UI elements |
| MEDIUM | PWA install prompt | `pwa-install-button.tsx` exists in components — wire `beforeinstallprompt` event |
| MEDIUM | `database.types.ts` regeneration | Run `supabase gen types` after any new migration to keep types current |
| LOW | Custom roles enforcement on page/action level | Currently only built-in roles gate pages; custom role permissions are UI-only |
| LOW | Branch scoping for staff | `memberships.branch_id` column exists but isn't enforced in page-level gates |
| LOW | Presence/smart notification routing | PHASE-10 spec: route notifications to first online user in branch |
| LOW | Stocktake page completion | Basic UI exists; verify close_count RPC integration |

---

## 11. Environment Variables

```bash
# Required in .env.local and Vercel
NEXT_PUBLIC_SUPABASE_URL=https://jqdmfbpmarxjpjcvmnvz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # public, safe in client
SUPABASE_SERVICE_ROLE_KEY=...            # secret — server/admin only
NEXT_PUBLIC_SITE_URL=https://auran.vercel.app
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=...        # hCaptcha for signup
HCAPTCHA_SECRET_KEY=...                  # server-side hCaptcha verify
```

---

## 12. Quick Reference: Adding a New Feature

1. **Read this file** — understand where the feature fits in the schema.
2. **Schema change needed?** Write a new migration `supabase/migrations/NNNN_name.sql`, apply via SQL Editor, regenerate types.
3. **New page?** Add route under `src/app/[locale]/(dashboard)/dashboard/your-page/page.tsx`. Add to `nav-config.ts` if it needs a sidebar entry.
4. **New server action?** Create `actions.ts` with `'use server'` header. Pattern: Zod parse → `getOwnerContext()` or auth check → DB operation → `revalidatePath` → return `{ ok, data?, error? }`.
5. **Write operations?** Use `enqueueAndRun(type, payload)` — not direct Supabase calls — so they work offline.
6. **Translations?** Add keys to both `messages/ar.json` and `messages/en.json` under the appropriate namespace.
7. **Build check:** `npx tsc --noEmit && npm run build`
8. **Deploy:** `git add . && git commit -m "feat: ..." && npx vercel --prod`
