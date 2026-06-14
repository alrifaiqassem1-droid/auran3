'use client';
import { useRouter } from 'next/navigation';
import { Store, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useActiveBranch } from '@/hooks/use-active-branch';

export function BranchSwitcher() {
  const router = useRouter();
  const { branches, activeBranchId, setActiveBranch } = useActiveBranch();

  if (branches.length === 0) return null;

  const activeBranch = branches.find(b => b.id === activeBranchId) ?? branches[0];

  function handleSelect(branchId: string) {
    if (branchId === activeBranchId) return;
    setActiveBranch(branchId); // writes cookie + localStorage + updates React state
    router.refresh();          // re-fetches all server components with the new cookie
  }

  // Single branch: show name as static badge (no dropdown needed)
  if (branches.length === 1) {
    return (
      <div className="flex h-7 items-center gap-1.5 rounded-lg bg-[#EF9F27]/[0.10] border border-[#EF9F27]/20 px-2.5 text-xs font-semibold text-[#ba7517] dark:text-[#EF9F27] max-w-[160px]">
        <Store className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{activeBranch?.name ?? '—'}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-7 items-center gap-1.5 rounded-lg bg-[#EF9F27]/[0.10] border border-[#EF9F27]/20 px-2.5 text-xs font-semibold text-[#ba7517] dark:text-[#EF9F27] hover:bg-[#EF9F27]/[0.18] transition-colors duration-200 max-w-[160px]">
          <Store className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{activeBranch?.name ?? '—'}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {branches.map(b => (
          <DropdownMenuItem
            key={b.id}
            onSelect={() => handleSelect(b.id)}
            className="gap-2"
          >
            <span className="flex-1">{b.name}</span>
            {b.id === activeBranchId && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
