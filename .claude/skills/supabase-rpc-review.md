# Skill: مراجعة Supabase RPC و RLS

> استخدمه قبل كتابة أو تعديل أي RPC، migration، أو server action يلمس قاعدة البيانات.

---

## مبادئ غير قابلة للتفاوض

### 1. العزل متعدد المستأجرين (Multi-tenancy)
- كل جدول عملياتي يحمل tenant_id
- RLS يستخدم auth_tenant_ids() للتحقق من الوصول
- الكود لا يمرّر tenant_id مباشرة أبداً — يُشتق من الجلسة المُصادَقة
- getOwnerContext() يعيد التحقق من الملكية في كل mutation

### 2. التحقق من الدور
_guard(p_tenant uuid, p_roles user_role[])
tenant أولاً، roles ثانياً. توثيق قديم عكسها — هذا هو الصحيح.

### 3. bootstrap_tenant
await supabase.rpc('bootstrap_tenant', {
  p_company:   companyName,
  p_full_name: fullName,
  p_user_id:   user.id,   // صريح دائماً
});
السبب: تُستدعى في server context حيث auth.uid() قد يرجع NULL.

---

## idempotency (أساس أمان الـ offline)

كل RPC كتابة يستخدم processed_ops:
- مفتاح client_op_id (يُولّد على العميل، ثابت لنفس العملية)
- إعادة تنفيذ نفس العملية → تعيد النتيجة المخزّنة بدل تكرارها
- هذا ما يجعل مزامنة الـ offline آمنة

خطأ شائع: توليد client_op_id جديد عند كل retry → يكسر الـ idempotency ويسبب تكراراً.

---

## SECURITY DEFINER + pgcrypto

أي RPC يستخدم pgcrypto (تشفير، hashing) يحتاج:
SET search_path = public, extensions
بدونه، الدوال لا تُوجد في المسار وتفشل على Supabase.

---

## قواعد سير العمل

1. تغييرات SQL يدوية دائماً عبر Supabase SQL Editor — لا تلقائي عبر Vercel.
2. بعد أي migration: أعد توليد الأنواع ثم حوّلها UTF-8:
   npx supabase gen types typescript --project-id jqdmfbpmarxjpjcvmnvz > src/types/database.types.ts
   ثم في PowerShell:
   $c = [IO.File]::ReadAllText('src/types/database.types.ts', [Text.Encoding]::Unicode)
   [IO.File]::WriteAllText('src/types/database.types.ts', $c, (New-Object Text.UTF8Encoding $false))
3. next-intl middleware يجب أن يستثني /api/* عبر matcher exclusion.

---

## نمط الـ Server Action الصحيح

'use server';

export async function myAction(input: unknown) {
  // 1. Zod parse
  const data = schema.parse(input);
  // 2. تحقق الصلاحية (owner/role) server-side
  const ctx = await getOwnerContext();
  // 3. عملية DB (عبر RPC أو enqueueAndRun للكتابة العملياتية)
  // 4. revalidatePath
  // 5. return { ok, data?, error? }
}

---

## Checklist مراجعة RPC

- هل _guard بالترتيب الصحيح؟ (p_tenant, p_roles)
- هل tenant_id يُشتق من الفرع/الجلسة لا من إدخال العميل؟
- هل العملية ذرّية؟ (كل-أو-لا-شيء، مع FOR UPDATE عند تعديل دفعات)
- هل idempotency مطبّق عبر processed_ops + client_op_id؟
- هل pgcrypto موجود؟ → أضف set search_path = public, extensions
- هل أعدت توليد database.types.ts بعد الـ migration؟
- هل الـ migration مطبّق يدوياً على Supabase (ليس عبر Vercel)؟
- هل اختبرت على auran.vercel.app؟

---

آخر تحديث: يونيو 2026