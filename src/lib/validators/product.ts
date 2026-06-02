import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2, 'يجب أن يكون الاسم حرفين على الأقل'),
  barcode: z.string().optional().or(z.literal('')),
  unit: z.enum(['pcs', 'kg']),
  category_id: z.string().uuid().optional().or(z.literal('')),
  cost_price: z.coerce.number().min(0, 'يجب أن يكون السعر 0 أو أكثر'),
  sell_price: z.coerce.number().min(0, 'يجب أن يكون السعر 0 أو أكثر'),
  vat_inclusive: z.boolean().default(true),
  low_stock_threshold: z.coerce.number().min(0).default(0),
  is_active: z.boolean().default(true),
});

export type ProductFormValues = z.infer<typeof productSchema>;
