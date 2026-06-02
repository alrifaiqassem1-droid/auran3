'use client';
import { Building2, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useActiveBranch } from '@/hooks/use-active-branch';

export function BranchSwitcher() {
  const { activeMembership, memberships, setActiveBranch } = useActiveBranch();

  if (memberships.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 max-w-[180px]">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">
            {activeMembership?.tenant_name ?? '—'}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {memberships.map(m => (
          <DropdownMenuItem
            key={m.branch_id ?? m.tenant_id}
            onSelect={() => m.branch_id && setActiveBranch(m.branch_id)}
            className="gap-2"
          >
            <span className="flex-1">{m.tenant_name}</span>
            {m.branch_id === activeMembership?.branch_id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
