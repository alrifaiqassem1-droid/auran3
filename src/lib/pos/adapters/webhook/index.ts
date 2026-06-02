/**
 * WebhookAdapter — Placeholder (قريباً)
 *
 * الاستخدام المستقبلي: استقبال بيانات مبيعات مباشرة عبر HTTP webhook.
 * يُرسل نظام POS الخارجي POST لـ /api/import/webhook مع Bearer token.
 * الـ endpoint يحوّل الـ payload لـ PosImportRow[] ثم يستدعي apply_pos_import.
 *
 * interface WebhookPayload {
 *   secret:     string;          // bearer token خاص بكل tenant
 *   branch_id:  string;
 *   source:     string;          // "MyPOS" | "Salla" | ...
 *   rows: Array<{
 *     barcode:   string;
 *     quantity:  number;
 *     total:     number;
 *     sold_at:   string;         // ISO 8601
 *   }>;
 * }
 */

export type WebhookAdapterInterface = 'placeholder — not implemented';
