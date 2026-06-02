'use client';
import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const IDLE_MS          = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL   = 60  * 1000;     // check every 1 minute
const STORAGE_KEY      = 'auran_last_activity';

function stamp() {
  if (typeof window !== 'undefined')
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
}

function getLastActivity(): number {
  if (typeof window === 'undefined') return Date.now();
  return parseInt(sessionStorage.getItem(STORAGE_KEY) || String(Date.now()), 10);
}

export function useSessionTimeout() {
  const handleIdle = useCallback(async () => {
    const idle = Date.now() - getLastActivity();
    if (idle < IDLE_MS) return;

    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace('/login');
  }, []);

  useEffect(() => {
    stamp();

    const events = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, stamp, { passive: true }));

    const interval = setInterval(handleIdle, CHECK_INTERVAL);

    return () => {
      events.forEach(e => window.removeEventListener(e, stamp));
      clearInterval(interval);
    };
  }, [handleIdle]);
}
