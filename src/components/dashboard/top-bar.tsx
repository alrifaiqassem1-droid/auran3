'use client';
import { BranchSwitcher } from './branch-switcher';
import { UserMenu } from './user-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { SyncIndicator } from '@/components/system/sync-indicator';
import { PwaInstallButton } from './pwa-install-button';

type Props = {
  name: string;
  userId: string;
  tenantId: string;
  branchId: string | null;
};

export function TopBar({ name, userId, tenantId, branchId }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-md">
      {/* Start: logo + branch switcher */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-black tracking-[0.25em] text-primary select-none">AURAN</span>
        <span className="h-4 w-px bg-border/70" />
        <BranchSwitcher />
      </div>

      {/* End: sync + install + lang + theme + bell + avatar */}
      <div className="flex items-center gap-1">
        <SyncIndicator />
        <PwaInstallButton />
        <LanguageSwitcher />
        <ThemeToggle />
        {userId && tenantId && (
          <NotificationBell userId={userId} tenantId={tenantId} branchId={branchId} />
        )}
        <div className="ms-1">
          <UserMenu name={name} />
        </div>
      </div>
    </header>
  );
}
