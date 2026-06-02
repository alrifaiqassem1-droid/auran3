import { z } from 'zod';

export const damageSchema = z.object({
  branch_id: z.string().uuid(),
  product_id: z.string().uuid('اختر منتجاً'),
  quantity: z.coerce.number().int('الكمية يجب أن تكون عدداً صحيحاً').min(1, 'الكمية يجب أن تكون أكبر من صفر'),
  reason: z.enum(['expired', 'broken', 'spoiled', 'other']),
  note: z.string().max(500).optional().or(z.literal('')),
});

export type DamageInput = z.infer<typeof damageSchema>;
