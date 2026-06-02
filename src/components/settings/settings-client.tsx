'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Building2, User, Shield, Palette, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function PwaInstallSection() {
  const t = useTranslations('Settings');
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (installed || !prompt) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') { setPrompt(null); setInstalled(true); }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{t('appSection')}</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t('installDesc')}</p>
      <Button
        onClick={install}
        className="h-11 w-full gap-2 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
      >
        <Download className="h-4 w-4" />
        {t('installApp')}
      </Button>
    </div>
  );
}

interface Props {
  userId: string;
  email: string;
  tenant: { id: string; name: string; trn: string | null; vat_rate: number } | null;
  profile: { full_name: string | null; phone: string | null } | null;
  role: string;
}

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function SettingsClient({ userId, email, tenant, profile, role }: Props) {
  const t = useTranslations('Settings');
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone]       = useState(profile?.phone ?? '');
  const [trn, setTrn]           = useState(tenant?.trn ?? '');
  const [tenantName, setTenantName] = useState(tenant?.name ?? '');

  const isOwner = role === 'owner';

  function saveProfile() {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, full_name: fullName.trim(), phone: phone.trim() });
      if (error) { toast.error(t('saveError')); return; }
      toast.success(t('profileSaved'));
    });
  }

  function saveTenant() {
    if (!tenant || !isOwner) return;
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from('tenants')
        .update({ name: tenantName.trim(), trn: trn.trim() || null })
        .eq('id', tenant.id);
      if (error) { toast.error(t('saveError')); return; }
      toast.success(t('tenantSaved'));
    });
  }

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      {/* Profile */}
      <Section icon={User} title={t('profileSection')}>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('email')}</label>
            <Input value={email} disabled className="bg-muted/30" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('fullName')}</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('fullNamePlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('phone')}</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971 50 000 0000"
              type="tel"
              dir="ltr"
            />
          </div>
          <Button
            onClick={saveProfile}
            disabled={isPending}
            className="h-11 w-full rounded-xl text-sm font-semibold"
          >
            {isPending ? t('saving') : t('saveProfile')}
          </Button>
        </div>
      </Section>

      {/* Company */}
      {tenant && (
        <Section icon={Building2} title={t('companySection')}>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('companyName')}</label>
              <Input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                disabled={!isOwner}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t('trn')}
              </label>
              <Input
                value={trn}
                onChange={(e) => setTrn(e.target.value)}
                placeholder="100123456700003"
                dir="ltr"
                disabled={!isOwner}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{t('trnHint')}</p>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">{t('vatRate')}</span>
              <span className="font-bold tabular-nums">{tenant.vat_rate}%</span>
            </div>
            {isOwner ? (
              <Button
                onClick={saveTenant}
                disabled={isPending}
                className="h-11 w-full rounded-xl text-sm font-semibold"
              >
                {isPending ? t('saving') : t('saveCompany')}
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">{t('ownerOnly')}</p>
            )}
          </div>
        </Section>
      )}

      {/* Role info */}
      <Section icon={Shield} title={t('accessSection')}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('yourRole')}</span>
          <Badge variant={role === 'owner' ? 'default' : 'secondary'} className="capitalize">
            {role}
          </Badge>
        </div>
      </Section>

      {/* Appearance */}
      <Section icon={Palette} title={t('appearanceSection')}>
        <p className="text-xs text-muted-foreground">{t('appearanceHint')}</p>
      </Section>

      {/* PWA install — shows only when installable */}
      <PwaInstallSection />
    </div>
  );
}
