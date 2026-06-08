'use client';

// Webhook adapter tab for the POS import wizard.
// Lets owner/manager generate a secret (shown once), copy the endpoint URL,
// list existing endpoints, and revoke them.

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Copy, Check, Trash2, KeyRound, Loader2 } from 'lucide-react';
import { useActiveBranch } from '@/hooks/use-active-branch';
import {
  listWebhooks,
  createWebhook,
  revokeWebhook,
  type WebhookListItem,
} from './webhook-actions';

const ENDPOINT_URL =
  (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auran.vercel.app') +
  '/api/import/webhook';

export function WebhookTab() {
  const t = useTranslations('Import');
  const { activeBranchId } = useActiveBranch();

  const [items, setItems] = useState<WebhookListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState<'url' | 'secret' | null>(null);

  const refresh = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    const res = await listWebhooks(activeBranchId);
    if (res.ok) setItems(res.data);
    setLoading(false);
  }, [activeBranchId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate() {
    if (!activeBranchId) {
      toast.error(t('webhookNoBranch'));
      return;
    }
    if (!label.trim()) {
      toast.error(t('webhookNeedLabel'));
      return;
    }
    setCreating(true);
    const res = await createWebhook(activeBranchId, label.trim());
    setCreating(false);
    if (res.ok) {
      setNewSecret(res.data.secret);
      setLabel('');
      toast.success(t('webhookCreated'));
      refresh();
    } else {
      toast.error(t('webhookError'));
    }
  }

  async function handleRevoke(id: string) {
    const res = await revokeWebhook(id);
    if (res.ok) {
      toast.success(t('webhookRevoked'));
      refresh();
    } else {
      toast.error(t('webhookError'));
    }
  }

  function copy(text: string, which: 'url' | 'secret') {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-6">
      {/* Endpoint URL */}
      <div className="rounded-xl border p-4 space-y-2">
        <p className="text-sm font-medium">{t('webhookEndpointUrl')}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">
            {ENDPOINT_URL}
          </code>
          <button
            type="button"
            onClick={() => copy(ENDPOINT_URL, 'url')}
            className="inline-flex items-center justify-center rounded-md border h-9 w-9 hover:bg-accent"
            aria-label={t('webhookCopy')}
          >
            {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('webhookSendHint')}</p>
      </div>

      {/* Create new endpoint */}
      <div className="rounded-xl border p-4 space-y-3">
        <p className="text-sm font-medium">{t('webhookCreateTitle')}</p>
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('webhookLabelPlaceholder')}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {t('webhookGenerate')}
          </button>
        </div>

        {newSecret && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {t('webhookSecretOnce')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                {newSecret}
              </code>
              <button
                type="button"
                onClick={() => copy(newSecret, 'secret')}
                className="inline-flex items-center justify-center rounded-md border h-8 w-8 hover:bg-accent"
                aria-label={t('webhookCopy')}
              >
                {copied === 'secret' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing endpoints */}
      <div className="rounded-xl border p-4 space-y-3">
        <p className="text-sm font-medium">{t('webhookListTitle')}</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('webhookLoading')}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('webhookEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{it.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.secret_prefix}…{' '}
                    {it.is_active ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {t('webhookActive')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t('webhookRevokedTag')}</span>
                    )}
                  </p>
                </div>
                {it.is_active && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(it.id)}
                    className="inline-flex items-center justify-center rounded-md border h-8 w-8 text-destructive hover:bg-destructive/10"
                    aria-label={t('webhookRevoke')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
