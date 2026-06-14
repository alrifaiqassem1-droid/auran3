import { headers } from 'next/headers';

export async function getClientInfo() {
  const h = await headers();
  const ip =
    h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = h.get('user-agent') || '';
  return { ip, userAgent };
}
