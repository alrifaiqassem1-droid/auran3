'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function markAsRead(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: 'جلسة غير صالحة' };

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .or(`user_id.eq.${user.id},user_id.is.null`);

  if (error) return { ok: false, error: 'فشل تحديث الإشعار' };

  revalidatePath('/dashboard/notifications');
  return { ok: true };
}

export async function markAllAsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: 'جلسة غير صالحة' };

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return { ok: false, error: 'فشل تحديث الإشعارات' };

  revalidatePath('/dashboard/notifications');
  return { ok: true };
}
