import { z } from 'zod';

export const posRowSchema = z.object({
  product_id: z.string().uuid().nullable(),
  barcode: z.string().nullable(),
  quantity: z.number().positive(),
  total: z.number().min(0),
  sold_at: z.string().nullable(),
});

export const posImportSchema = z.object({
  branch_id: z.string().uuid(),
  source: z.string().default('POS2'),
  file_name: z.string(),
  rows: z.array(posRowSchema).min(1, 'No valid rows'),
});

export type PosRow = z.infer<typeof posRowSchema>;
export type PosImportInput = z.infer<typeof posImportSchema>;
