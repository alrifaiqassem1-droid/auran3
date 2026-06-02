import { z } from 'zod';

// Strong password: 12+ chars, uppercase, number, special character
const strongPassword = z
  .string()
  .min(12, 'passwordTooShort')
  .regex(/[A-Z]/, 'passwordNeedsUppercase')
  .regex(/[0-9]/, 'passwordNeedsNumber')
  .regex(/[^A-Za-z0-9]/, 'passwordNeedsSpecial');

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const signupSchema = z.object({
  email:       z.string().email(),
  password:    strongPassword,
  fullName:    z.string().min(2).max(80),
  companyName: z.string().min(2).max(80),
});

export type LoginInput  = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// Password requirements for UI strength indicator
export const PASSWORD_RULES = [
  { key: 'passwordTooShort',       test: (p: string) => p.length >= 12 },
  { key: 'passwordNeedsUppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'passwordNeedsNumber',    test: (p: string) => /[0-9]/.test(p) },
  { key: 'passwordNeedsSpecial',   test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;
