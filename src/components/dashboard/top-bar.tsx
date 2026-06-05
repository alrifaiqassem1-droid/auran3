'use client';
import { BranchSwitcher } from './branch-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { UserMenu } from './user-menu';

type Props = { user: { name: string; email: string } };

export function TopBar({ user }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-[52px] items-center justify-between border-b border-border/40 bg-[#fafaf8] dark:bg-[#0d0d0d] px-3 transition-colors duration-200">
      {/* Left: theme toggle + language toggle */}
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      {/* Right: branch selector + user avatar dropdown + AURAN logo */}
      <div className="flex items-center gap-2.5">
        <BranchSwitcher />
        <UserMenu name={user.name} email={user.email} />
        <span className="text-sm font-black tracking-[0.2em] text-[#EF9F27] select-none">AURAN</span>
      </div>
    </header>
  );
}
