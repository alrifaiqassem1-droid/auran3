'use client';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/app/[locale]/(auth)/actions';

type Props = { name: string };

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

export function UserMenu({ name }: Props) {
  const t = useTranslations('Dashboard');
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => { await signOut(); });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none rounded-full" disabled={pending}>
          <Avatar className="h-8 w-8 ring-2 ring-primary/30 hover:ring-primary/60 transition-all">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {pending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : initials(name)
              }
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold truncate">{name}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onSelect={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
