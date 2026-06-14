'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Membership } from '@/lib/auth/get-session';

type ActiveBranchCtx = {
  activeBranchId: string | null;
  activeMembership: Membership | null;
  memberships: Membership[];
  setActiveBranch: (id: string) => void;
};

const Ctx = createContext<ActiveBranchCtx>({
  activeBranchId: null,
  activeMembership: null,
  memberships: [],
  setActiveBranch: () => {},
});

const COOKIE_NAME = 'auran_active_branch';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function writeBranchCookie(id: string | null) {
  try {
    if (id) {
      document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    } else {
      document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    }
  } catch { /* SSR / restricted WebView */ }
}

export function ActiveBranchProvider({
  memberships,
  children,
}: {
  memberships: Membership[];
  children: ReactNode;
}) {
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(
    memberships[0]?.branch_id ?? null
  );

  // On mount: read localStorage, validate against memberships, then sync cookie
  // so the server cookie and client state always agree after hydration.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_NAME);
      const valid = memberships.find(m => m.branch_id === stored);
      const resolved = valid?.branch_id ?? memberships[0]?.branch_id ?? null;
      if (valid?.branch_id) setActiveBranchIdState(valid.branch_id);
      writeBranchCookie(resolved);
    } catch { /* localStorage blocked (private/WebView) */ }
  }, [memberships]);

  function setActiveBranch(id: string) {
    setActiveBranchIdState(id);
    try { localStorage.setItem(COOKIE_NAME, id); } catch { /* blocked */ }
    writeBranchCookie(id);
  }

  const activeMembership =
    memberships.find(m => m.branch_id === activeBranchId) ?? memberships[0] ?? null;

  return (
    <Ctx.Provider value={{ activeBranchId, activeMembership, memberships, setActiveBranch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActiveBranch() {
  return useContext(Ctx);
}
