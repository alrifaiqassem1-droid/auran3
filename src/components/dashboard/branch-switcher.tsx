'use client';
import { Store, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useActiveBranch } from '@/hooks/use-active-branch';

export function BranchSwitcher() {
  const { activeMembership, memberships, setActiveBranch } = useActiveBranch();

  if (memberships.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-7 items-center gap-1.5 rounded-lg bg-[#EF9F27]/[0.10] border border-[#EF9F27]/20 px-2.5 text-xs font-semibold text-[#ba7517] dark:text-[#EF9F27] hover:bg-[#EF9F27]/[0.18] transition-colors duration-200 max-w-[160px]">
          <Store className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{activeMembership?.branch_name ?? activeMembership?.tenant_name ?? '—'}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {memberships.map(m => (
          <DropdownMenuItem
            key={m.branch_id ?? m.tenant_id}
            onSelect={() => m.branch_id && setActiveBranch(m.branch_id)}
            className="gap-2"
          >
            <span className="flex-1">{m.branch_name ?? m.tenant_name}</span>
            {m.branch_id === activeMembership?.branch_id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
