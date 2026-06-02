// ============================================================================
// AURAN · نواة المزامنة دون اتصال — الطابور  (كود حرفي مقفول)
// المسار النهائي: src/lib/offline/queue.ts
//
// المبدأ:
//  - كل عملية حرجة تُنفَّذ عبر enqueueAndRun(): تُسجّل في IndexedDB أولاً،
//    ثم تُحاول فوراً إن كان هناك اتصال.
//  - المفتاح id = client_op_id يُمرَّر للـ RPC ⇒ السيرفر يتجاهل التكرار
//    (idempotency)، فإعادة المزامنة آمنة 100% ولا تُكرّر الخصم/الاستلام.
//  - عند العودة للاتصال: flushQueue() ينفّذ المعلّق بالترتيب مع إعادة محاولة.
// ============================================================================
import { getDB, type OpType, type QueuedJob } from './db';
import { createClient } from '@/lib/supabase/client';

const MAX_ATTEMPTS = 6;

/** uuid v4 يعمل في المتصفح (يفضّل crypto.randomUUID المدعوم حديثاً). */
export function newOpId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** خريطة نوع العملية → اسم دالة RPC في Postgres. */
const RPC_NAME: Record<OpType, string> = {
  receive_goods: 'receive_goods',
  record_damage: 'record_damage',
  close_count: 'close_count',
  apply_pos_import: 'apply_pos_import',
};

/** ينفّذ RPC واحد على Supabase. يرمي عند الفشل. */
async function runRpc(type: OpType, payload: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(RPC_NAME[type], { p_payload: payload });
  if (error) throw error;
  return data;
}

export interface RunResult {
  ok: boolean;
  queued: boolean; // هل بقيت في الطابور للمزامنة لاحقاً؟
  data?: unknown;
  error?: string;
}

/**
 * نقطة الدخول الموحّدة لكل عملية حرجة.
 * 1) يولّد client_op_id ويحقنه في الـ payload.
 * 2) يسجّل الـ job في IndexedDB (pending).
 * 3) إن كان متصلاً: ينفّذ فوراً ويحذف الـ job عند النجاح.
 *    إن كان غير متصل أو فشل: يتركه في الطابور ويعيد queued=true.
 */
export async function enqueueAndRun(
  type: OpType,
  payload: Record<string, unknown>,
): Promise<RunResult> {
  const id = (payload.client_op_id as string) || newOpId();
  const fullPayload = { ...payload, client_op_id: id };
  const db = await getDB();
  const now = Date.now();

  const job: QueuedJob = {
    id, type, payload: fullPayload, status: 'pending',
    attempts: 0, createdAt: now, updatedAt: now,
  };
  await db.put('jobs', job);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: true, queued: true };
  }

  try {
    const data = await runRpc(type, fullPayload);
    await db.delete('jobs', id);
    return { ok: true, queued: false, data };
  } catch (e: any) {
    // فشل مؤقت (شبكة) → يبقى في الطابور. فشل دائم (صلاحية) → نعلّمه failed.
    const msg = e?.message ?? String(e);
    const permanent = /AURAN_|42501|forbidden/i.test(msg);
    await db.put('jobs', {
      ...job, status: permanent ? 'failed' : 'pending',
      attempts: 1, lastError: msg, updatedAt: Date.now(),
    });
    return { ok: false, queued: !permanent, error: msg };
  }
}

/** عدد العمليات المعلّقة (للمؤشّر في الواجهة). */
export async function pendingCount(): Promise<number> {
  const db = await getDB();
  return (await db.getAllFromIndex('jobs', 'by-status', 'pending')).length;
}

/**
 * يفرّغ الطابور بالترتيب الزمني. يُستدعى عند عودة الاتصال.
 * آمن للاستدعاء المتكرر بفضل idempotency في السيرفر.
 * يعيد عدد ما نجح وما فشل.
 */
let _flushing = false;
export async function flushQueue(): Promise<{ done: number; failed: number }> {
  if (_flushing) return { done: 0, failed: 0 };
  _flushing = true;
  let done = 0, failed = 0;
  try {
    const db = await getDB();
    const jobs = (await db.getAllFromIndex('jobs', 'by-created'))
      .filter((j) => j.status === 'pending');

    for (const job of jobs) {
      try {
        await db.put('jobs', { ...job, status: 'syncing', updatedAt: Date.now() });
        const data = await runRpc(job.type, job.payload);
        await db.delete('jobs', job.id);
        done++;
        void data;
      } catch (e: any) {
        const attempts = job.attempts + 1;
        const msg = e?.message ?? String(e);
        const permanent = /AURAN_|42501|forbidden/i.test(msg) || attempts >= MAX_ATTEMPTS;
        await db.put('jobs', {
          ...job, attempts, lastError: msg,
          status: permanent ? 'failed' : 'pending', updatedAt: Date.now(),
        });
        failed++;
      }
    }
  } finally {
    _flushing = false;
  }
  return { done, failed };
}

/** يربط المزامنة التلقائية بحدث عودة الاتصال. استدعِه مرة في AppShell. */
export function registerAutoFlush(onSynced?: (r: { done: number; failed: number }) => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = async () => {
    const r = await flushQueue();
    if ((r.done || r.failed) && onSynced) onSynced(r);
  };
  window.addEventListener('online', handler);
  // محاولة عند الإقلاع أيضاً (قد يكون هناك متبقٍّ من جلسة سابقة)
  if (navigator.onLine) void handler();
  return () => window.removeEventListener('online', handler);
}
