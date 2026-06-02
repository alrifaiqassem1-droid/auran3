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

  useEffect(() => {
    try {
      const stored = localStorage.getItem('auran_active_branch');
      const valid = memberships.find(m => m.branch_id === stored);
      if (valid?.branch_id) setActiveBranchIdState(valid.branch_id);
    } catch { /* localStorage blocked (private/WebView) */ }
  }, [memberships]);

  function setActiveBranch(id: string) {
    setActiveBranchIdState(id);
    try { localStorage.setItem('auran_active_branch', id); } catch { /* blocked */ }
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
