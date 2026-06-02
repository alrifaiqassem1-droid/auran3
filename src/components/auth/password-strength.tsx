'use client';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PASSWORD_RULES } from '@/lib/validators/auth';

type Props = { password: string };

export function PasswordStrength({ password }: Props) {
  const t = useTranslations('Auth');
  if (!password) return null;

  const score = PASSWORD_RULES.filter(r => r.test(password)).length;
  const pct   = (score / PASSWORD_RULES.length) * 100;

  const barColor =
    score <= 1 ? 'bg-destructive' :
    score <= 2 ? 'bg-amber-500'   :
    score <= 3 ? 'bg-yellow-400'  :
                 'bg-emerald-500';

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Requirements list */}
      <ul className="space-y-0.5">
        {PASSWORD_RULES.map(rule => {
          const ok = rule.test(password);
          return (
            <li
              key={rule.key}
              className={cn(
                'flex items-center gap-1.5 text-[11px] transition-colors',
                ok ? 'text-emerald-500' : 'text-muted-foreground'
              )}
            >
              {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {t(rule.key as Parameters<typeof t>[0])}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
