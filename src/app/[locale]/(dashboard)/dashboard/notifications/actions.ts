'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function markAsRead(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: 'جلسة غير صالحة' };

  // Validate the caller can see this notification via notif_select RLS
  // (covers personal rows where user_id = auth.uid() AND broadcast rows where user_id IS NULL).
  // This read check is what authorises the write below.
  const { data: notif } = await supabase
    .from('notifications')
    .select('id')
    .eq('id', notificationId)
    .single();
  if (!notif) return { ok: false, error: 'الإشعار غير موجود' };

  // notif_update RLS is "user_id = auth.uid()" — it silently matches zero rows for broadcast
  // notifications (user_id IS NULL). Use the service-role client, scoped to just this ID,
  // which was already validated as visible to the caller above.
  const admin = createAdminClient();
  const { error } = await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

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
