# دليل Webhook — AURAN

> اربط أي نظام POS خارجي بـ AURAN مباشرةً عبر HTTP POST.
> المبيعات تُرسَل لحظياً وتُخصم من المخزون بـ FEFO تلقائياً.

---

## 1. كيف يعمل الـ Webhook

```
نظام POS الخارجي
       │
       │ POST https://auran.vercel.app/api/import/webhook
       │ Authorization: Bearer {SECRET_TOKEN}
       │ Content-Type: application/json
       │
       ▼
  AURAN API Route
       │
       ├── تحقق من الـ token → تحديد tenant + branch
       ├── تحقق Zod من صحة البيانات
       ├── استدعاء apply_pos_import RPC
       └── خصم FEFO من stock_batches
       │
       ▼
  HTTP 200 { success: true, matched: N, unmatched: M }
```

### متى تستخدم الـ Webhook؟

| السيناريو | الطريقة المناسبة |
|-----------|----------------|
| POS يمكنه إرسال HTTP | ✅ Webhook (الأفضل) |
| POS يُصدّر ملف CSV | CSV Adapter |
| بيانات قليلة يومياً | Manual Adapter |
| Foodics / Salla | Adapters المتخصصة (قريباً) |

---

## 2. تنسيق JSON المطلوب

### الطلب (Request)

```http
POST https://auran.vercel.app/api/import/webhook
Authorization: Bearer auran_wh_abc123xyz...
Content-Type: application/json
```

```json
{
  "branch_id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "MyPOS",
  "rows": [
    {
      "barcode":  "6281234567890",
      "quantity": 2,
      "total":    35.50,
      "sold_at":  "2026-06-01T14:30:00Z"
    },
    {
      "barcode":  "6281234567891",
      "quantity": 1,
      "total":    18.00,
      "sold_at":  "2026-06-01T14:30:00Z"
    }
  ]
}
```

### حقول الـ Request

| الحقل | النوع | مطلوب | الوصف |
|-------|-------|--------|-------|
| `branch_id` | UUID | ✅ | UUID الفرع في AURAN |
| `source` | string | ✅ | اسم نظام POS (للتقارير) |
| `rows` | array | ✅ | مصفوفة المبيعات (1–5000 صف) |
| `rows[].barcode` | string | ✅* | باركود المنتج |
| `rows[].quantity` | number | ✅ | الكمية المباعة (موجب) |
| `rows[].total` | number | ✅ | إجمالي السطر بـ AED (شامل VAT) |
| `rows[].sold_at` | ISO 8601 | ✅ | وقت البيع |

> *إن لم يكن لديك باركود، أرسل `product_id` (UUID) بدلاً منه.

### الاستجابة الناجحة (200)

```json
{
  "success":   true,
  "import_id": "7f3d9a2e-...",
  "matched":   2,
  "unmatched": 0,
  "deducted":  3.0
}
```

### استجابات الخطأ

| الكود | السبب |
|-------|-------|
| `401` | Token غير صحيح أو مفقود |
| `400` | JSON غير صحيح أو حقول ناقصة |
| `404` | `branch_id` غير موجود |
| `403` | الـ token لا يملك صلاحية لهذا الفرع |
| `429` | تجاوز حد الطلبات (100 طلب/دقيقة) |
| `500` | خطأ داخلي — تواصل مع الدعم |

---

## 3. إعداد الـ Webhook في AURAN

> **ملاحظة:** هذه الميزة قيد التطوير. الـ endpoint موجود في الكود لكن يحتاج تفعيل token في الإعدادات.

### الخطوة 1: الحصول على الـ Secret Token

```
الإعدادات → الشركة → مفاتيح API → إنشاء مفتاح Webhook
```

الـ Token بصيغة: `auran_wh_` + 32 حرف عشوائي

### الخطوة 2: الحصول على branch_id

```
الإعدادات → الفروع → [اسم الفرع] → نسخ UUID
```

أو عبر API:
```http
GET https://auran.vercel.app/api/branches
Authorization: Bearer {SECRET_TOKEN}
```

### الخطوة 3: ضبط نظام POS الخارجي

أدخل هذه المعلومات في نظام POS:
- **Webhook URL:** `https://auran.vercel.app/api/import/webhook`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer {TOKEN}`, `Content-Type: application/json`
- **Trigger:** عند كل بيع / نهاية الوردية / يومياً

---

## 4. أمثلة بـ Postman

### إعداد Postman Collection

```json
{
  "info": { "name": "AURAN Webhook", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  "variable": [
    { "key": "base_url", "value": "https://auran.vercel.app" },
    { "key": "token",    "value": "auran_wh_YOUR_TOKEN_HERE" },
    { "key": "branch",   "value": "YOUR_BRANCH_UUID_HERE" }
  ]
}
```

### مثال 1: بيع عادي

```
POST {{base_url}}/api/import/webhook
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "branch_id": "{{branch}}",
  "source": "Postman Test",
  "rows": [
    {
      "barcode":  "6281234567890",
      "quantity": 1,
      "total":    12.50,
      "sold_at":  "{{$isoTimestamp}}"
    }
  ]
}
```

**النتيجة المتوقعة:**
```json
{ "success": true, "matched": 1, "unmatched": 0, "deducted": 1.0 }
```

### مثال 2: وردية كاملة (متعدد الأصناف)

```json
{
  "branch_id": "{{branch}}",
  "source": "CashierShift",
  "rows": [
    { "barcode": "6281111111111", "quantity": 3,   "total": 45.00, "sold_at": "2026-06-01T08:00:00Z" },
    { "barcode": "6282222222222", "quantity": 1,   "total": 22.50, "sold_at": "2026-06-01T09:15:00Z" },
    { "barcode": "6283333333333", "quantity": 0.5, "total": 18.75, "sold_at": "2026-06-01T10:30:00Z" },
    { "barcode": "UNKNOWN-CODE",  "quantity": 2,   "total": 30.00, "sold_at": "2026-06-01T11:45:00Z" }
  ]
}
```

**النتيجة المتوقعة:**
```json
{
  "success":   true,
  "matched":   3,
  "unmatched": 1,
  "deducted":  4.5
}
```

> الصف الرابع (`UNKNOWN-CODE`) غير متطابق — يُسجَّل بدون خصم للمراجعة لاحقاً.

### مثال 3: اختبار Token خاطئ

```
POST {{base_url}}/api/import/webhook
Authorization: Bearer wrong_token_here
Content-Type: application/json
{ "branch_id": "...", "source": "test", "rows": [] }
```

**النتيجة:**
```json
{ "error": "Unauthorized", "code": 401 }
```

### مثال 4: اختبار بيانات ناقصة

```json
{
  "branch_id": "{{branch}}",
  "source": "test",
  "rows": [
    { "barcode": "123", "quantity": -1, "total": 10 }
  ]
}
```

**النتيجة:**
```json
{
  "error":   "Validation failed",
  "details": "rows[0].quantity: Number must be greater than 0"
}
```

### مثال 5: cURL (للمطورين)

```bash
curl -X POST https://auran.vercel.app/api/import/webhook \
  -H "Authorization: Bearer auran_wh_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "YOUR_BRANCH_UUID",
    "source":    "cURL Test",
    "rows": [{
      "barcode":  "6281234567890",
      "quantity": 1,
      "total":    15.00,
      "sold_at":  "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
    }]
  }'
```

### مثال 6: Python (تكامل سكريبت)

```python
import requests
from datetime import datetime, timezone

WEBHOOK_URL = "https://auran.vercel.app/api/import/webhook"
TOKEN       = "auran_wh_YOUR_TOKEN"
BRANCH_ID   = "YOUR_BRANCH_UUID"

def send_sales(sales_data: list[dict]) -> dict:
    rows = [
        {
            "barcode":  item["barcode"],
            "quantity": item["qty"],
            "total":    item["amount"],
            "sold_at":  datetime.now(timezone.utc).isoformat(),
        }
        for item in sales_data
    ]

    response = requests.post(
        WEBHOOK_URL,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type":  "application/json",
        },
        json={"branch_id": BRANCH_ID, "source": "Python Script", "rows": rows},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()

# استخدام
result = send_sales([
    {"barcode": "6281234567890", "qty": 2,   "amount": 35.00},
    {"barcode": "6281234567891", "qty": 0.5, "amount": 12.50},
])
print(f"✅ Matched: {result['matched']}, Unmatched: {result['unmatched']}")
```

### مثال 7: Node.js / TypeScript

```typescript
const AURAN_WEBHOOK = 'https://auran.vercel.app/api/import/webhook';

interface SaleItem {
  barcode:  string;
  quantity: number;
  total:    number;
}

async function pushSalesToAuran(items: SaleItem[], branchId: string): Promise<void> {
  const res = await fetch(AURAN_WEBHOOK, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AURAN_WEBHOOK_TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      branch_id: branchId,
      source:    'NodeJS Integration',
      rows: items.map((item) => ({
        ...item,
        sold_at: new Date().toISOString(),
      })),
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`AURAN webhook failed: ${JSON.stringify(err)}`);
  }

  const result = await res.json();
  console.log(`✅ ${result.matched} matched, ${result.unmatched} unmatched`);
}
```

---

## أفضل الممارسات

### 1. أرسل على دُفعات لا صفاً صفاً

```json
// ❌ تجنّب: طلب لكل بيع
POST /api/import/webhook → { rows: [1 صف] }   × 200 مرة

// ✅ الأفضل: مجموعة كل 15 دقيقة أو بنهاية الوردية
POST /api/import/webhook → { rows: [200 صف] }  × 1 مرة
```

### 2. احتفظ بـ import_id للمراجعة

```python
result = send_sales(items)
log.info(f"Import {result['import_id']}: {result['matched']} matched")
```

### 3. تعامل مع الأخطاء بذكاء

```python
import time

def send_with_retry(sales, max_retries=3):
    for attempt in range(max_retries):
        try:
            return send_sales(sales)
        except requests.HTTPError as e:
            if e.response.status_code == 429:  # Rate limit
                time.sleep(60)
            elif e.response.status_code >= 500:  # Server error
                time.sleep(10 * (attempt + 1))
            else:
                raise  # 4xx لا تُعيد المحاولة
    raise Exception("Failed after retries")
```

### 4. تحقق من Unmatched بانتظام

الصفوف غير المتطابقة مسجّلة في `pos_import_items` بدون `product_id`.
راجع تقارير الاستيراد أسبوعياً لمطابقة الباركودات الجديدة.

---

## استكشاف الأخطاء

| المشكلة | السبب المحتمل | الحل |
|---------|--------------|------|
| `401 Unauthorized` | Token منتهي أو خاطئ | أنشئ token جديداً من الإعدادات |
| `404 branch not found` | UUID الفرع خاطئ | تحقق من UUID في إعدادات AURAN |
| `matched: 0` دائماً | الباركودات غير مسجّلة | أضف المنتجات في AURAN أولاً |
| `quantity: 0` | الكميات تُرسَل كـ string | تحقق من نوع البيانات (number لا string) |
| Timeout | صفوف كثيرة جداً | قسّم إلى دُفعات ≤ 1000 صف |

---

## الـ Rate Limits

| الخطة | طلبات/دقيقة | صفوف/طلب | صفوف/يوم |
|-------|------------|---------|----------|
| مجانية | 10 | 100 | 1,000 |
| احترافية | 100 | 1,000 | 50,000 |
| مؤسسية | غير محدود | 5,000 | غير محدود |

---

*للدعم التقني: [github.com/your-org/auran/issues](https://github.com)*
