// ============================================================================
// AURAN · نواة المزامنة دون اتصال — مخزن IndexedDB  (كود حرفي مقفول)
// المسار النهائي: src/lib/offline/db.ts
// يعتمد على: idb
// ============================================================================
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/** أنواع العمليات الحرجة التي تُطابر عند انقطاع الاتصال. */
export type OpType = 'receive_goods' | 'record_damage' | 'close_count' | 'apply_pos_import';

export type JobStatus = 'pending' | 'syncing' | 'failed';

export interface QueuedJob {
  /** المفتاح = client_op_id (uuid) — هو نفسه مفتاح الـ idempotency في السيرفر. */
  id: string;
  type: OpType;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

interface AuranDB extends DBSchema {
  jobs: {
    key: string;
    value: QueuedJob;
    indexes: { 'by-status': JobStatus; 'by-created': number };
  };
}

let _db: Promise<IDBPDatabase<AuranDB>> | null = null;

export function getDB() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!_db) {
    _db = openDB<AuranDB>('auran', 1, {
      upgrade(db) {
        const store = db.createObjectStore('jobs', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-created', 'createdAt');
      },
    }).catch((err) => { _db = null; throw err; });
  }
  return _db;
}
