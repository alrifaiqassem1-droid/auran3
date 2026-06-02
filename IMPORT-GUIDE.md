# دليل نظام الاستيراد — AURAN Import Engine

> **الجمهور المستهدف:** المطورون الذين يريدون ربط نظام POS جديد أو توسيع قدرات الاستيراد.

---

## 1. كيف يعمل النظام

### المعمارية العامة

```
┌─────────────────────────────────────────────────────────┐
│                    Import Engine                         │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ CSV      │  │ Manual   │  │ Webhook  │  │Foodic  │  │
│  │ Adapter  │  │ Adapter  │  │ (قريباً) │  │(قريباً)│  │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └────────┘  │
│       │              │                                   │
│       └──────────────┘                                   │
│               │                                          │
│        PosImportRow[]                                    │
│               │                                          │
│    apply_pos_import (Supabase RPC)                       │
│               │                                          │
│    خصم FEFO من stock_batches                             │
└─────────────────────────────────────────────────────────┘
```

### مبدأ العمل

كل Adapter يقوم بتحويل مصدر بيانات مختلف (ملف CSV، إدخال يدوي، API، Webhook) إلى نفس الشكل الموحّد `PosImportRow[]`، ثم يُرسله إلى دالة `apply_pos_import` في Supabase التي تخصم المخزون بـ **FEFO** (الأقرب انتهاءً أولاً).

### تدفق البيانات الكامل

```
المستخدم/النظام الخارجي
        ↓
   Adapter (تحويل)
        ↓
  PosImportRow[] (شكل موحّد)
        ↓
  enqueueAndRun('apply_pos_import', payload)
        ↓
  IndexedDB (حفظ مؤقت للأوفلاين)
        ↓
  Supabase RPC: apply_pos_import()
        ↓
  ┌─────────────────────────────────────────┐
  │  لكل صف:                               │
  │  - بحث بالباركود → product_id          │
  │  - خصم الكمية FEFO من stock_batches    │
  │  - تسجيل stock_movements (type=sale)   │
  │  - حفظ pos_import_items                │
  └─────────────────────────────────────────┘
        ↓
  النتيجة: { matched, unmatched, deducted }
```

---

## 2. كيف تضيف Adapter جديد — خطوة بخطوة

### الخطوة 1: تسجيل الـ Adapter في Engine

افتح `src/lib/pos/engine.ts` وأضف:

```typescript
importEngine.register({
  id:        'my-system',           // معرّف فريد (أحرف صغيرة + شرطة)
  nameKey:   'adapterMySystemName', // مفتاح ترجمة في messages/ar.json + en.json
  descKey:   'adapterMySystemDesc',
  icon:      'ShoppingCart',        // اسم أيقونة من lucide-react
  available: true,                  // false = placeholder "قريباً"
});
```

### الخطوة 2: إنشاء مكوّن الواجهة

أنشئ `src/components/import/adapters/my-system-tab.tsx`:

```typescript
'use client';
import { useTransition } from 'react';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { enqueueAndRun } from '@/lib/offline/queue';
import type { MatchableProduct } from '@/app/[locale]/(dashboard)/import/actions';
import type { PosImportRow } from '@/lib/pos/engine';

interface Props {
  products:  MatchableProduct[];
  onSuccess: (r: { matched: number; unmatched: number }) => void;
}

export function MySystemTab({ products, onSuccess }: Props) {
  const { activeBranchId } = useActiveBranch();
  const [isPending, startTransition] = useTransition();

  function handleImport(rawData: unknown) {
    // 1. حوّل البيانات الخام إلى PosImportRow[]
    const rows: PosImportRow[] = transformMyData(rawData, products);

    // 2. أرسل للـ RPC (يعمل أونلاين/أوفلاين تلقائياً)
    startTransition(async () => {
      const res = await enqueueAndRun('apply_pos_import', {
        branch_id: activeBranchId!,
        source:    'MySystem',
        file_name: 'my-system-export',
        rows,
      } as Record<string, unknown>);

      if (res.ok) {
        const d = res.data as { matched?: number; unmatched?: number } | null;
        onSuccess({ matched: d?.matched ?? 0, unmatched: d?.unmatched ?? 0 });
      }
    });
  }

  return (/* ... واجهة المستخدم ... */);
}

function transformMyData(raw: unknown, products: MatchableProduct[]): PosImportRow[] {
  // منطق التحويل الخاص بنظامك
  return [];
}
```

### الخطوة 3: ربط المكوّن بالـ Wizard

افتح `src/components/import/pos-import-wizard.tsx` وأضف:

```typescript
// في imports:
import { MySystemTab } from './adapters/my-system-tab';

// في JSX (داخل AnimatePresence):
{activeId === 'my-system' && (
  <MySystemTab products={products} onSuccess={handleSuccess} />
)}
```

### الخطوة 4: إضافة الترجمات

في `messages/ar.json` و `messages/en.json` داخل namespace `Import`:

```json
"adapterMySystemName": "نظامي",
"adapterMySystemDesc": "استيراد من نظام X",
```

### الخطوة 5: اختبار

```bash
npm run build   # تأكد من عدم وجود أخطاء TypeScript
npm run dev     # جرّب الاستيراد محلياً
vercel --prod   # انشر
```

---

## 3. مثال عملي: ربط Foodics

### الوضع الحالي
Foodics Adapter موجود كـ placeholder في `src/lib/pos/adapters/foodic/index.ts`.

### خطوات التطبيق الكامل

**أولاً: OAuth2 في Foodics**

```typescript
// src/app/api/foodic/auth/route.ts
export async function GET() {
  const authUrl = new URL('https://console.foodics.com/oauth/authorize');
  authUrl.searchParams.set('client_id',     process.env.FOODIC_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri',  `${process.env.NEXT_PUBLIC_SITE_URL}/api/foodic/callback`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope',         'branch.reports');
  return Response.redirect(authUrl.toString());
}

// src/app/api/foodic/callback/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')!;

  const tokenRes = await fetch('https://console.foodics.com/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      grant_type:    'authorization_code',
      client_id:     process.env.FOODIC_CLIENT_ID,
      client_secret: process.env.FOODIC_CLIENT_SECRET,
      code,
      redirect_uri:  `${process.env.NEXT_PUBLIC_SITE_URL}/api/foodic/callback`,
    }),
  });
  const { access_token } = await tokenRes.json();
  // احفظ access_token في tenant settings
}
```

**ثانياً: جلب تقارير المبيعات**

```typescript
// src/lib/pos/adapters/foodic/sync.ts
export async function fetchFoodicSales(
  accessToken: string,
  branchRef:   string,
  date:        string, // "2026-06-01"
): Promise<PosImportRow[]> {
  const res = await fetch(
    `https://api.foodics.com/v5/orders?branch_reference=${branchRef}&date=${date}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const { data } = await res.json();

  return data.flatMap((order: FoodicOrder) =>
    order.products.map((item) => ({
      product_id:   null,
      barcode:      item.product?.barcode ?? null,
      quantity:     item.quantity,
      total:        item.total_price,
      sold_at:      order.opened_at,
    })),
  );
}
```

**ثالثاً: الواجهة**

```typescript
// src/components/import/adapters/foodic-tab.tsx
export function FoodicTab({ products, onSuccess }: Props) {
  const [date, setDate] = useState(todayISO());

  async function sync() {
    const rows = await fetchFoodicSales(storedToken, branchRef, date);
    const res = await enqueueAndRun('apply_pos_import', {
      branch_id: activeBranchId!, source: 'Foodic',
      file_name: `foodic-${date}`, rows,
    });
    if (res.ok) onSuccess(...);
  }

  return (
    <div>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button onClick={sync}>استيراد من Foodics</button>
    </div>
  );
}
```

**متغيرات البيئة المطلوبة:**
```bash
FOODIC_CLIENT_ID=your_client_id
FOODIC_CLIENT_SECRET=your_client_secret
```

---

## 4. مثال عملي: ربط أي نظام قديم عبر CSV

### السيناريو
نظام POS قديم يُصدّر تقريراً يومياً بصيغة CSV بأعمدة مختلفة.

### الخطوة 1: تحميل القالب

اضغط على **"تحميل قالب CSV فارغ"** في صفحة الاستيراد. الملف يحتوي:

```csv
barcode,product_name,quantity,total,sold_at
6281234567890,لحم بقري,2,35.00,2026-06-01 10:30
```

### الخطوة 2: تحويل تنسيق النظام القديم

إذا كانت أعمدة ملفك مختلفة:

| أعمدة نظامك القديم | يقابله في AURAN |
|---------------------|----------------|
| `Item Code`         | `barcode`      |
| `Product`           | `product_name` |
| `Qty Sold`          | `quantity`     |
| `Amount`            | `total`        |
| `Trans Date`        | `sold_at`      |

### الخطوة 3: رفع الملف

1. اذهب إلى **الاستيراد → ملف CSV**
2. ارفع الملف — سيكشف Auto-mapper الأعمدة تلقائياً
3. إن لم يكشف الأعمدة بشكل صحيح، ربطها يدوياً
4. اضغط **"حفظ القالب"** باسم "نظامي القديم"
5. في المرة القادمة، سيتعرّف عليه تلقائياً ✅

### الخطوة 4: أتمتة العملية (اختياري)

يمكنك كتابة سكريبت Python لتحويل الملف تلقائياً:

```python
# convert_pos.py
import pandas as pd

df = pd.read_csv('pos_export.csv')
df = df.rename(columns={
    'Item Code':  'barcode',
    'Product':    'product_name',
    'Qty Sold':   'quantity',
    'Amount':     'total',
    'Trans Date': 'sold_at',
})
df[['barcode','product_name','quantity','total','sold_at']].to_csv('auran_import.csv', index=False)
```

---

## 5. جدول الأنظمة المدعومة والمخططة

| الطريقة | الحالة | الوصف | الجهد لإضافتها |
|---------|--------|-------|----------------|
| **CSV (يدوي)** | ✅ متاح | رفع ملف CSV من أي نظام | — |
| **إدخال يدوي** | ✅ متاح | إدخال المبيعات سطراً سطراً | — |
| **Webhook HTTP** | 🔒 قريباً | النظام يُرسل للـ API مباشرة | ~2 يوم |
| **Foodics** | 🔒 قريباً | OAuth2 + sync تلقائي | ~3 أيام |
| **Salla POS** | 📋 مخطط | API Salla للمبيعات | ~2 يوم |
| **Excel (.xlsx)** | 📋 مخطط | قراءة ملفات Excel مباشرة | ~1 يوم |
| **WhatsApp CSV** | 📋 مخطط | تقارير WhatsApp Business | ~1 يوم |
| **Zid POS** | 📋 مخطط | API Zid | ~2 يوم |
| **iiko** | 📋 مخطط | نظام المطاعم الروسي | ~3 أيام |

---

## 6. كيف يعمل Auto-mapper وكيف تضبطه

### خوارزمية الكشف

```
1. استقبال أعمدة الملف (headers[])
2. تحويل كل اسم عمود → أحرف صغيرة + استبدال المسافات بـ _
3. مطابقة ضد قائمة أنماط لكل حقل:
   - barcode:   ['barcode', 'ean', 'upc', 'sku', 'code', 'رمز', 'باركود', ...]
   - quantity:  ['qty', 'quantity', 'units', 'count', 'كمية', 'عدد', ...]
   - total:     ['total', 'amount', 'gross', 'مبلغ', 'إجمالي', ...]
   - sold_at:   ['date', 'datetime', 'sold_at', 'تاريخ', ...]
4. أول تطابق يفوز
```

### نظام القوالب (localStorage)

```
┌──────────────────────────────────────────────────────────┐
│ رفع ملف → حساب بصمة الأعمدة                            │
│ fingerprint = sort(headers).join('|')                    │
│                                                          │
│ هل يوجد قالب محفوظ لهذه البصمة؟                         │
│                                                          │
│   نعم → تطبيق القالب المحفوظ + بنر "تم تحميل القالب"    │
│   لا  → الكشف التلقائي بالأنماط                         │
│                                                          │
│ المستخدم يضبط الأعمدة يدوياً                             │
│ يضغط "حفظ القالب" + اسم                                  │
│                                                          │
│ localStorage['auran_pos_tpl_${fingerprint}']             │
│ = { name: "نظامي", mapping: { barcode: "Kod", ... } }   │
└──────────────────────────────────────────────────────────┘
```

### إضافة أنماط كشف جديدة

افتح `src/lib/pos/parse-csv.ts` وعدّل `PATTERNS`:

```typescript
const PATTERNS: Record<keyof ColumnMapping, string[]> = {
  barcode: [
    'barcode', 'ean', 'upc', 'sku', 'code', 'item_code',
    'رمز', 'باركود',
    'artikel_nummer',  // ألماني
    'codigo',          // إسباني
    'ref',             // فرنسي
    // أضف أنماطك هنا ↓
  ],
  quantity: [ ... ],
  total:    [ ... ],
  sold_at:  [ ... ],
};
```

### إضافة حقل جديد للـ Mapping

إذا أردت دعم حقل إضافي (مثلاً `discount` أو `tax`):

1. أضف الحقل في `ColumnMapping` بـ `parse-csv.ts`
2. أضف أنماطه في `PATTERNS`
3. أضف العمود في `ColumnMapper` component
4. أضف الحقل في `PosImportRow` بـ `engine.ts`
5. عدّل `apply_pos_import` RPC في Supabase

---

## ملاحظات مهمة

### الأمان
- كل استيراد يمر عبر RPC `apply_pos_import` التي تتحقق من الصلاحيات (manager+ فقط)
- يُمنع إرسال `tenant_id` من العميل — الـ RPC تستخرجه من الفرع نفسه
- idempotency مدمجة: إعادة نفس الاستيراد لا تُكرّر الخصم

### الأوفلاين
- الاستيراد يعمل بدون إنترنت — يُحفظ في IndexedDB
- عند عودة الاتصال يُزامَن تلقائياً مع ضمان عدم التكرار

### FEFO
- الخصم يتبع FEFO: الأقرب انتهاءً يُخصم أولاً
- هذا المنطق مقفول في Supabase RPC — لا يمكن تجاوزه من الواجهة
