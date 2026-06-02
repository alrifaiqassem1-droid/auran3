'use client';

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { playNotificationSound } from './sound';
import { showBrowserNotification } from './morning-check';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

type Handler = (n: AppNotification) => void;

let _channel: RealtimeChannel | null = null;

export function subscribeToNotifications(
  userId: string,
  tenantId: string,
  branchId: string | null,
  onNew: Handler,
): () => void {
  const supabase = createClient();

  _channel?.unsubscribe();

  _channel = supabase
    .channel(`notif-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => handleNew(payload.new as AppNotification, onNew),
    )
    // Also listen to branch-level (user_id=null) notifications
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: branchId ? `branch_id=eq.${branchId}` : `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        const n = payload.new as AppNotification & { user_id?: string | null };
        if (!n.user_id) handleNew(n, onNew);
      },
    )
    .subscribe();

  return () => { _channel?.unsubscribe(); _channel = null; };
}

function handleNew(n: AppNotification, onNew: Handler) {
  onNew(n);
  playNotificationSound();
  showBrowserNotification(n.title, n.body ?? '', '/notifications');
}
