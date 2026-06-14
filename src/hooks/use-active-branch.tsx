'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Membership } from '@/lib/auth/get-session';

export type Branch = { id: string; name: string; is_default: boolean };

type ActiveBranchCtx = {
  activeBranchId: string | null;
  activeMembership: Membership | null;
  memberships: Membership[];
  branches: Branch[];
  setActiveBranch: (id: string) => void;
};

const Ctx = createContext<ActiveBranchCtx>({
  activeBranchId: null,
  activeMembership: null,
  memberships: [],
  branches: [],
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
  branches,
  initialActiveBranchId,
  children,
}: {
  memberships: Membership[];
  branches: Branch[];
  initialActiveBranchId: string | null;
  children: ReactNode;
}) {
  // Initialise from the server-resolved value (cookie) so first render is correct.
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(
    initialActiveBranchId ?? memberships[0]?.branch_id ?? null
  );

  // On mount: validate localStorage against the real branch list, then sync cookie.
  // Validates against `branches` (not memberships) so owners with branch_id=null work.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_NAME);
      const validBranchId = branches.find(b => b.id === stored)?.id ?? null;
      const resolved = validBranchId ?? initialActiveBranchId ?? null;
      if (validBranchId) setActiveBranchIdState(validBranchId);
      writeBranchCookie(resolved);
    } catch { /* localStorage blocked (private/WebView) */ }
  }, [memberships]); // memberships ref changes on each server re-render — correct timing

  function setActiveBranch(id: string) {
    setActiveBranchIdState(id);
    try { localStorage.setItem(COOKIE_NAME, id); } catch { /* blocked */ }
    writeBranchCookie(id);
  }

  const activeMembership =
    memberships.find(m => m.branch_id === activeBranchId) ?? memberships[0] ?? null;

  return (
    <Ctx.Provider value={{ activeBranchId, activeMembership, memberships, branches, setActiveBranch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActiveBranch() {
  return useContext(Ctx);
}
