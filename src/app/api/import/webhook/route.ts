// src/app/api/import/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const rowSchema = z.object({
  product_id: z.string().uuid().nullable().optional().default(null),
  barcode: z.string().nullable().optional().default(null),
  quantity: z.number().positive(),
  total: z.number().min(0).optional().default(0),
  sold_at: z.string().nullable().optional().default(null),
});

const bodySchema = z.object({
  source: z.string().optional().default('Webhook'),
  file_name: z.string().optional().default('webhook'),
  client_op_id: z.string().uuid().optional(),
  rows: z.array(rowSchema).min(1, 'No rows'),
});

function readSecret(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const secret = readSecret(req);
  if (!secret) {
    return NextResponse.json(
      { error: 'AURAN_NO_SECRET', message: 'Missing Authorization: Bearer <secret>' },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'AURAN_BAD_JSON', message: 'Body must be valid JSON' },
      { status: 422 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'AURAN_BAD_PAYLOAD', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('webhook_pos_import', {
    p_secret: secret,
    p_payload: parsed.data,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('AURAN_BAD_SECRET') || msg.includes('AURAN_NO_SECRET')) {
      return NextResponse.json({ error: 'AURAN_BAD_SECRET' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'AURAN_RPC_ERROR', message: msg },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, result: data }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
}
