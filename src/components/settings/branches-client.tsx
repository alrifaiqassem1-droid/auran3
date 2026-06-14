'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Star, Pencil, Trash2, Check, X, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  createBranch,
  updateBranch,
  setDefaultBranch,
  deleteBranch,
  type BranchRow,
} from '@/app/[locale]/(dashboard)/dashboard/settings/branches/actions';

interface Props {
  initialBranches: BranchRow[];
  isOwner: boolean;
}

export function BranchesClient({ initialBranches, isOwner }: Props) {
  const t = useTranslations('Settings');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addAddress, setAddAddress] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function startEdit(b: BranchRow) {
    setEditingId(b.id);
    setEditName(b.name);
    setEditAddress(b.address ?? '');
    setShowAdd(false);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleCreate() {
    if (!addName.trim()) return;
    startTransition(async () => {
      const res = await createBranch(addName.trim(), addAddress.trim() || undefined);
      if (res.ok) {
        toast.success(t('branchCreated'));
        setShowAdd(false);
        setAddName('');
        setAddAddress('');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleUpdate(id: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      const res = await updateBranch(id, editName.trim(), editAddress.trim() || undefined);
      if (res.ok) {
        toast.success(t('branchUpdated'));
        setEditingId(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const res = await setDefaultBranch(id);
      if (res.ok) {
        toast.success(t('defaultBranchSet'));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }
    startTransition(async () => {
      const res = await deleteBranch(id);
      if (res.ok) {
        toast.success(t('branchDeleted'));
        setDeleteConfirmId(null);
        router.refresh();
      } else {
        const msg =
          res.error === 'cannotDeleteDefault' ? t('cannotDeleteDefault') :
          res.error === 'branchHasMembers'    ? t('branchHasMembers')    :
          res.error;
        toast.error(msg);
      }
    });
  }

  const canAdd = true; // owner or manager — already gated at page level

  return (
    <div className="space-y-3">
      {/* Add form */}
      {showAdd ? (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <Input
            placeholder={t('branchName')}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            autoFocus
            disabled={isPending}
          />
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <Input
              placeholder={t('branchAddress')}
              value={addAddress}
              onChange={(e) => setAddAddress(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleCreate} disabled={isPending || !addName.trim()}>
              {isPending ? t('saving') : t('addBranch')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setAddName(''); setAddAddress(''); }} disabled={isPending}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        canAdd && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => { setShowAdd(true); setEditingId(null); }}
          >
            <Plus className="h-4 w-4" />
            {t('addBranch')}
          </Button>
        )
      )}

      {/* Branch list */}
      {initialBranches.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Building2 className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t('noBranches')}</p>
        </div>
      )}

      {initialBranches.map((b) => (
        <div key={b.id} className="rounded-xl border bg-card p-4 space-y-3">
          {editingId === b.id ? (
            <>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                disabled={isPending}
              />
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <Input
                  placeholder={t('branchAddress')}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => handleUpdate(b.id)} disabled={isPending || !editName.trim()}>
                  <Check className="h-4 w-4 me-1" />
                  {isPending ? t('saving') : t('saveChanges')}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={isPending}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{b.name}</span>
                  {b.is_default && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Star className="h-3 w-3" />
                      {t('defaultBranch')}
                    </Badge>
                  )}
                </div>
                {b.address && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {b.address}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => startEdit(b)}
                  title={t('edit')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>

                {isOwner && !b.is_default && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleSetDefault(b.id)}
                    disabled={isPending}
                    title={t('setDefault')}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}

                {isOwner && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`h-8 w-8 ${deleteConfirmId === b.id ? 'text-destructive hover:text-destructive' : ''}`}
                    onClick={() => handleDelete(b.id)}
                    disabled={isPending}
                    title={t('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
