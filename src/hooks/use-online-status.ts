'use client';
import { useState, useEffect, useCallback } from 'react';

export type OnlineStatus = 'online' | 'offline' | 'reconnected';

export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>('online');
  const [prevStatus, setPrevStatus] = useState<OnlineStatus>('online');

  const probe = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(4000) });
      return r.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      const reachable = await probe();
      if (reachable) {
        setStatus((prev) => {
          setPrevStatus(prev);
          return 'reconnected';
        });
        // Reset to 'online' after showing reconnect banner (3 s)
        setTimeout(() => setStatus('online'), 3500);
      }
    };

    const handleOffline = () => {
      setStatus((prev) => { setPrevStatus(prev); return 'offline'; });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic probe every 30 s to catch silent disconnects
    const interval = setInterval(async () => {
      if (!navigator.onLine) { handleOffline(); return; }
      const ok = await probe();
      if (!ok && status !== 'offline') handleOffline();
    }, 30_000);

    // Initial check
    if (!navigator.onLine) setStatus('offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [probe, status]);

  return { status, isOffline: status === 'offline', isReconnected: status === 'reconnected' };
}
