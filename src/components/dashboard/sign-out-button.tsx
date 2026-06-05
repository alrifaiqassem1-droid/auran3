'use client';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type Props = { className?: string };

export function SignOutButton({ className }: Props) {
  const t = useTranslations('Nav');
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace('/login');
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
        'text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
        'disabled:opacity-50',
        className,
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      <span>{t('signOut')}</span>
    </button>
  );
}
