import { z } from 'zod';

export const receiveLineSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  unit: z.enum(['pcs', 'kg']),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  cost_price: z.coerce.number().min(0, 'التكلفة يجب أن تكون 0 أو أكثر'),
  expiry_date: z.string().nullable().optional(),
});

export const receivingSchema = z.object({
  branch_id: z.string().uuid(),
  supplier_id: z.string().optional().or(z.literal('')),
  reference: z.string().max(100).optional().or(z.literal('')),
  lines: z.array(receiveLineSchema).min(1, 'أضف صنفاً واحداً على الأقل'),
});

export type ReceiveLine = z.infer<typeof receiveLineSchema>;
export type ReceivingInput = z.infer<typeof receivingSchema>;
