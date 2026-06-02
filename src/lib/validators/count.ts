import { z } from 'zod';

export const upsertCountItemSchema = z.object({
  count_id: z.string().uuid(),
  product_id: z.string().uuid(),
  counted_qty: z.coerce.number().min(0),
});

export type UpsertCountItemInput = z.infer<typeof upsertCountItemSchema>;
