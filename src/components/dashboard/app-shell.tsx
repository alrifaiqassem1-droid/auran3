'use client';
import { type ReactNode, useEffect } from 'react';
import { usePathname } from '@/i18n/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TopBar } from './top-bar';
import { BottomNav } from './bottom-nav';
import { SideNav } from './side-nav';
import { ActiveBranchProvider, useActiveBranch } from '@/hooks/use-active-branch';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import { OfflineBanner } from '@/components/system/offline-banner';
import { registerAutoFlush } from '@/lib/offline/queue';
import { needsMorningCheck, runExpiryCheck, requestNotificationPermission } from '@/lib/notifications/morning-check';
import { ExpiryAlert } from '@/components/system/expiry-alert';
import type { Membership } from '@/lib/auth/get-session';
import type { UserRole } from '@/types/db';

type Props = {
  user: { name: string; id: string };
  memberships: Membership[];
  children: ReactNode;
};

function ShellInner({ user, memberships, children }: Props) {
  const pathname = usePathname();
  const reduced  = useReducedMotion();
  const role: UserRole = (memberships[0]?.role ?? 'staff') as UserRole;
  const { activeBranchId, activeMembership } = useActiveBranch();

  useSessionTimeout();

  // Register auto-flush when connection is restored
  useEffect(() => {
    const unsub = registerAutoFlush();
    return unsub;
  }, []);

  // Morning expiry check (6 AM or on first open if >6h since last check)
  useEffect(() => {
    if (!activeBranchId) return;
    if (!needsMorningCheck()) return;

    requestNotificationPermission().catch(() => {});

    const now = new Date();
    const target = new Date(now);
    target.setHours(6, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil6am = target.getTime() - now.getTime();

    // Run immediately if due, also schedule for 6 AM
    runExpiryCheck(activeBranchId).catch(() => {});
    const timer = setTimeout(() => runExpiryCheck(activeBranchId).catch(() => {}), msUntil6am);
    return () => clearTimeout(timer);
  }, [activeBranchId]);

  return (
    <div className="flex h-[100dvh] flex-col">
      <TopBar
        name={user.name}
        userId={user.id}
        tenantId={activeMembership?.tenant_id ?? ''}
        branchId={activeBranchId}
      />
      <OfflineBanner />
      <ExpiryAlert branchId={activeBranchId} />
      <div className="flex flex-1 overflow-hidden">
        <SideNav role={role} />
        <main className="flex-1 overflow-y-auto pb-safe-nav">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -8 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav role={role} />
    </div>
  );
}

export function AppShell(props: Props) {
  return (
    <ActiveBranchProvider memberships={props.memberships}>
      <ShellInner {...props} />
    </ActiveBranchProvider>
  );
}
