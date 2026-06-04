/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, NetworkFirst, Serwist, StaleWhileRevalidate } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Paths that must always reach the network — never cached, never intercepted
const BYPASS_PATH = /\/(auth|login|signup|verify-email|join)(\/|$|\?)/;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Supabase REST/storage — GET only; auth endpoints bypass SW entirely
    // (POST auth calls must never be intercepted — cache.put() rejects POST requests)
    {
      matcher: ({ url, request }) =>
        /^https:\/\/.*\.supabase\.co\/(rest|storage)/.test(url.href) &&
        request.method === 'GET',
      handler: new NetworkFirst({ cacheName: 'supabase-api', networkTimeoutSeconds: 8 }),
    },
    // Fonts — CacheFirst long TTL
    {
      matcher: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
      handler: new CacheFirst({ cacheName: 'google-fonts' }),
    },
    // Static assets (Next.js _next/static) — CacheFirst
    {
      matcher: /\/_next\/static\//,
      handler: new CacheFirst({ cacheName: 'next-static' }),
    },
    // Pages (HTML navigation) — GET only; auth/signup/login pages always hit network
    {
      matcher: ({ request, url }) =>
        request.mode === 'navigate' &&
        request.method === 'GET' &&
        !BYPASS_PATH.test(url.pathname),
      handler: new StaleWhileRevalidate({ cacheName: 'pages' }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// Push notification handler
self.addEventListener('push', (event) => {
  const data = (event as PushEvent).data?.json() as
    | { title?: string; body?: string; url?: string }
    | undefined;
  const title = data?.title ?? 'AURAN';
  const body  = data?.body  ?? '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url: data?.url ?? '/' },
    }),
  );
});

// Notification click — open/focus app
self.addEventListener('notificationclick', (event) => {
  (event as NotificationEvent).notification.close();
  const url = (event as NotificationEvent).notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
