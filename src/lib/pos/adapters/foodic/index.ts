/**
 * FoodicAdapter — Placeholder (قريباً)
 *
 * الاستخدام المستقبلي: ربط مباشر مع Foodic POS API.
 * يستخدم OAuth2 لجلب تقارير المبيعات اليومية تلقائياً.
 *
 * interface FoodicConfig {
 *   client_id:     string;
 *   client_secret: string;
 *   restaurant_id: string;
 *   branch_id:     string;       // Foodic branch UUID
 * }
 *
 * الخطوات المستقبلية:
 * 1. OAuth2 flow: GET /oauth/authorize → callback → store tokens
 * 2. Daily sync job: GET /v2/sales?date={today} → transform → apply_pos_import
 * 3. Webhooks: Foodic يرسل sale.completed → real-time deduction
 *
 * وثائق Foodic API: https://docs.foodics.com
 */

export type FoodicAdapterInterface = 'placeholder — not implemented';
