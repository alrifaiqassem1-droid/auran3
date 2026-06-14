import { z } from 'zod';

export const branchSchema = z.object({
  name:    z.string().min(1, 'Name is required').max(100),
  address: z.string().max(200).optional(),
});
