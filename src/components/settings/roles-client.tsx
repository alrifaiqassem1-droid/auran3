'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2, UserMinus, Mail, Shield, Users, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  createRole, updateRole, deleteRole,
  updateMemberRole, removeMember,
  sendInvitation, cancelInvitation,
  type CustomRole, type StaffMember, type Invitation, type RolePermissions,
} from '@/app/[locale]/(dashboard)/dashboard/settings/roles/actions';

// ─── Default permissions ──────────────────────────────────────

const DEFAULT_PERMISSIONS: RolePermissions = {
  products:  { view: true,  add: false, edit: false, delete: false },
  receiving: { view: true,  add: false },
  inventory: { view: true,  add: false },
  damage:    { view: true,  add: false },
  reports:   { view: false },
  prices:    { view: false },
  staff:     { view: false, add: false, edit: false, delete: false },
};

// ─── Permissions editor ───────────────────────────────────────

function PermissionsTable({
  value, onChange,
}: {
  value: RolePermissions;
  onChange: (v: RolePermissions) => void;
}) {
  const t = useTranslations('Roles');

  const MODULE_DEFS: { key: keyof RolePermissions; label: string; perms: string[] }[] = [
    { key: 'products',  label: t('modProducts'),  perms: ['view', 'add', 'edit', 'delete'] },
    { key: 'receiving', label: t('modReceiving'),  perms: ['view', 'add']                   },
    { key: 'inventory', label: t('modInventory'),  perms: ['view', 'add']                   },
    { key: 'damage',    label: t('modDamage'),     perms: ['view', 'add']                   },
    { key: 'reports',   label: t('modReports'),    perms: ['view']                          },
    { key: 'prices',    label: t('modPrices'),     perms: ['view']                          },
    { key: 'staff',     label: t('modStaff'),      perms: ['view', 'add', 'edit', 'delete'] },
  ];

  const PERM_LABELS: Record<string, string> = {
    view: t('permView'), add: t('permAdd'), edit: t('permEdit'), delete: t('permDelete'),
  };

  function toggle(mod: keyof RolePermissions, perm: string) {
    onChange({
      ...value,
      [mod]: { ...(value[mod] as Record<string, boolean>), [perm]: !((value[mod] as Record<string, boolean>)[perm]) },
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="px-3 py-2 text-start font-semibold">{t('sectionHeader')}</th>
            {['view', 'add', 'edit', 'delete'].map((p) => (
              <th key={p} className="px-2 py-2 text-center font-semibold">{PERM_LABELS[p]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULE_DEFS.map((mod) => (
            <tr key={mod.key} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2.5 font-medium">{mod.label}</td>
              {['view', 'add', 'edit', 'delete'].map((p) => (
                <td key={p} className="px-2 py-2 text-center">
                  {mod.perms.includes(p) ? (
                    <Switch
                      checked={!!((value[mod.key] as Record<string, boolean>)[p])}
                      onCheckedChange={() => toggle(mod.key, p)}
                    />
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Role dialog ──────────────────────────────────────────────

function RoleDialog({
  existing,
  onClose,
}: {
  existing?: CustomRole;
  onClose: () => void;
}) {
  const t = useTranslations('Roles');
  const [name, setName] = useState(existing?.name ?? '');
  const [perms, setPerms] = useState<RolePermissions>(existing?.permissions ?? DEFAULT_PERMISSIONS);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!name.trim()) { toast.error(t('roleNameRequired')); return; }
    startTransition(async () => {
      const res = existing
        ? await updateRole(existing.id, name, perms)
        : await createRole(name, perms);
      if (res.ok) { toast.success(existing ? t('roleUpdated') : t('roleCreated')); onClose(); }
      else toast.error(res.error ?? t('saveFailed'));
    });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? t('editRole') : t('newRole')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('roleName')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" placeholder={t('roleNamePlaceholder')} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">{t('permissionsLabel')}</label>
            <PermissionsTable value={perms} onChange={setPerms} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 flex-1 rounded-xl">{t('cancel')}</Button>
          <Button onClick={save} disabled={pending} className="h-11 flex-1 rounded-xl font-semibold">
            {pending ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invite dialog ────────────────────────────────────────────

function InviteDialog({
  roles,
  onClose,
}: {
  roles: CustomRole[];
  onClose: () => void;
}) {
  const t = useTranslations('Roles');
  const [email, setEmail] = useState('');
  const [defaultRole, setDefaultRole] = useState<'manager' | 'staff'>('staff');
  const [customRoleId, setCustomRoleId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function sendInvite() {
    if (!email.trim()) { toast.error(t('emailRequired')); return; }
    startTransition(async () => {
      const res = await sendInvitation(email, defaultRole, customRoleId);
      if (res.ok && res.token) {
        const link = `${window.location.origin}/join?token=${res.token}`;
        setInviteLink(link);
        toast.success(t('inviteCreated'));
      } else {
        toast.error(res.error ?? t('createFailed'));
      }
    });
  }

  function copyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('inviteStaff')}</DialogTitle>
        </DialogHeader>

        {!inviteLink ? (
          <div className="space-y-3 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('emailLabel')}</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" dir="ltr" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('defaultPermission')}</label>
              <div className="flex gap-2">
                {(['manager', 'staff'] as const).map((r) => (
                  <button key={r}
                    onClick={() => setDefaultRole(r)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${defaultRole === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                    {r === 'manager' ? t('manager') : t('staff')}
                  </button>
                ))}
              </div>
            </div>
            {roles.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('customRoleLabel')}</label>
                <select
                  value={customRoleId ?? ''}
                  onChange={(e) => setCustomRoleId(e.target.value || null)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="">{t('noCustomRole')}</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">{t('inviteExpiry')}</p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">{t('shareLink')}</p>
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
              <span className="flex-1 truncate font-mono text-[11px]">{inviteLink}</span>
              <button onClick={copyLink} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
            <p className="text-[11px] text-amber-600">{t('linkValid')}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 flex-1 rounded-xl">{t('close')}</Button>
          {!inviteLink && (
            <Button onClick={sendInvite} disabled={pending} className="h-11 flex-1 rounded-xl font-semibold">
              {pending ? t('creating') : t('createLink')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────

interface Props {
  initialRoles:       CustomRole[];
  initialStaff:       StaffMember[];
  initialInvitations: Invitation[];
}

export function RolesClient({ initialRoles, initialStaff, initialInvitations }: Props) {
  const t = useTranslations('Roles');
  const [roles, setRoles]               = useState(initialRoles);
  const [staff, setStaff]               = useState(initialStaff);
  const [invitations, setInvitations]   = useState(initialInvitations);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole]   = useState<CustomRole | undefined>();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [pending, startTransition]      = useTransition();

  const refreshData = async () => {
    const { getRolesAndStaff } = await import('@/app/[locale]/(dashboard)/dashboard/settings/roles/actions');
    const data = await getRolesAndStaff();
    if (data) { setRoles(data.roles); setStaff(data.staff); setInvitations(data.invitations); }
  };

  function handleRoleDialogClose() {
    setShowRoleDialog(false);
    setEditingRole(undefined);
    refreshData();
  }

  function handleDeleteRole(id: string) {
    startTransition(async () => {
      const res = await deleteRole(id);
      if (res.ok) { toast.success(t('roleDeleted')); await refreshData(); }
      else toast.error(res.error ?? t('deleteFailed'));
    });
  }

  function handleRemoveMember(membershipId: string) {
    startTransition(async () => {
      const res = await removeMember(membershipId);
      if (res.ok) { toast.success(t('memberRemoved')); await refreshData(); }
      else toast.error(res.error ?? t('removeFailed'));
    });
  }

  function handleCancelInvitation(id: string) {
    startTransition(async () => {
      const res = await cancelInvitation(id);
      if (res.ok) { toast.success(t('inviteCanceled')); await refreshData(); }
      else toast.error(res.error ?? t('cancelInviteFailed'));
    });
  }

  function handleRoleChange(membershipId: string, defaultRole: 'owner' | 'manager' | 'staff', customRoleId: string | null) {
    startTransition(async () => {
      const res = await updateMemberRole(membershipId, customRoleId, defaultRole);
      if (res.ok) { toast.success(t('roleUpdateSuccess')); await refreshData(); }
      else toast.error(res.error ?? t('roleUpdateFailed'));
    });
  }

  const roleLabel = (r: string) => r === 'owner' ? t('owner') : r === 'manager' ? t('manager') : t('staff');

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <Tabs defaultValue="roles">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="roles" className="flex-1 gap-1.5">
            <Shield className="h-3.5 w-3.5" /> {t('tabRoles')} ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex-1 gap-1.5">
            <Users className="h-3.5 w-3.5" /> {t('tabStaff')} ({staff.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Roles tab ────────────────────────────────────── */}
        <TabsContent value="roles">
          <div className="space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5">
                <Shield className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.member_count} {t('employee')}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs"
                    onClick={() => { setEditingRole(role); setShowRoleDialog(true); }}>
                    {t('edit')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg p-0 text-destructive hover:text-destructive"
                    disabled={pending} onClick={() => handleDeleteRole(role.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            <Button onClick={() => { setEditingRole(undefined); setShowRoleDialog(true); }}
              className="h-11 w-full gap-2 rounded-xl font-semibold" variant="outline">
              <Plus className="h-4 w-4" /> {t('newRole')}
            </Button>
          </div>
        </TabsContent>

        {/* ── Staff tab ─────────────────────────────────────── */}
        <TabsContent value="staff">
          <div className="space-y-3">
            {staff.map((member) => (
              <div key={member.id} className="rounded-xl border border-border/60 bg-card px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(member.user_name ?? member.user_email ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{member.user_name ?? member.user_email ?? t('unknownUser')}</p>
                    {member.user_email && <p className="text-xs text-muted-foreground truncate">{member.user_email}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-[10px]">
                        {roleLabel(member.role)}
                      </Badge>
                      {member.custom_role_name && (
                        <Badge variant="outline" className="text-[10px]">{member.custom_role_name}</Badge>
                      )}
                    </div>
                  </div>
                  {member.role !== 'owner' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        defaultValue={member.role}
                        disabled={pending}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as 'owner' | 'manager' | 'staff', member.custom_role_id)}
                        className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
                      >
                        <option value="owner">{t('owner')}</option>
                        <option value="manager">{t('manager')}</option>
                        <option value="staff">{t('staff')}</option>
                      </select>
                      <Button size="sm" variant="ghost"
                        className="h-8 w-8 rounded-lg p-0 text-destructive hover:text-destructive"
                        disabled={pending} onClick={() => handleRemoveMember(member.id)}>
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pending invitations */}
            {invitations.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('pendingInvitations')}</p>
                {invitations.map((inv) => (
                  <div key={inv.id} className="mb-2 flex items-center gap-3 rounded-xl border border-dashed border-border/60 px-4 py-3">
                    <Mail className="h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{inv.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {inv.custom_role_name ?? roleLabel(inv.default_role)} · {t('expiresOn')} {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost"
                      className="h-8 w-8 rounded-lg p-0 text-destructive"
                      disabled={pending} onClick={() => handleCancelInvitation(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={() => setShowInviteDialog(true)}
              className="h-11 w-full gap-2 rounded-xl font-semibold" variant="outline">
              <Mail className="h-4 w-4" /> {t('inviteStaff')}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {showRoleDialog && (
        <RoleDialog existing={editingRole} onClose={handleRoleDialogClose} />
      )}
      {showInviteDialog && (
        <InviteDialog roles={roles} onClose={() => { setShowInviteDialog(false); refreshData(); }} />
      )}
    </div>
  );
}
