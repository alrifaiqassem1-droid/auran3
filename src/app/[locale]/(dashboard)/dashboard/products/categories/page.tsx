'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

type Category = {
  id: string
  name: string
  default_critical_days: number
  default_warning_days: number
  created_at: string
}

export default function CategoriesPage() {
  const t = useTranslations('Categories')
  const supabase = useMemo(() => createClient(), [])

  const [categories, setCategories] = useState<Category[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [initialLoad, setInitialLoad] = useState(true)
  const [tenantId, setTenantId] = useState<string | null>(null)

  const fetchTenantId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    return data?.tenant_id ?? null
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const tid = await fetchTenantId()
      setTenantId(tid)

      if (!tid) {
        setInitialLoad(false)
        return
      }

      const { data, error } = await supabase
        .from('categories')
        .select('id, name, default_critical_days, default_warning_days, created_at')
        .eq('tenant_id', tid)
        .order('name', { ascending: true })

      if (error) {
        toast.error(t('loadError'))
      } else {
        setCategories(data ?? [])
      }
      setInitialLoad(false)
    }
    init()
  }, [fetchTenantId, supabase, t])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !tenantId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          name: newName.trim(),
          tenant_id: tenantId,
          default_critical_days: 7,
          default_warning_days: 30,
        }])
        .select('id, name, default_critical_days, default_warning_days, created_at')

      if (error) throw error
      if (data?.[0]) {
        const added = data[0] as Category
        setCategories(prev =>
          [...prev, added].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
        )
        setNewName('')
        toast.success(t('addSuccess'))
      }
    } catch {
      toast.error(t('addError'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) throw error
      setCategories(prev => prev.filter(c => c.id !== id))
      toast.success(t('deleteSuccess'))
    } catch {
      toast.error(t('deleteError'))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="container max-w-3xl py-6 px-4">
      <div className="mb-6 flex items-center gap-3">
        <Tag className="w-6 h-6 text-[hsl(41,68%,48%)]" />
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('pageSubtitle')}</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('addNew')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-3">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t('namePlaceholder')}
              disabled={loading || !tenantId}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !newName.trim() || !tenantId}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Plus className="w-4 h-4 ml-2" />
              )}
              {t('add')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {initialLoad ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t('loading')}</span>
          </div>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('empty')}
            </CardContent>
          </Card>
        ) : (
          categories.map(cat => (
            <Card key={cat.id}>
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="font-medium">{cat.name}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('criticalDays', { n: cat.default_critical_days })}
                      {' · '}
                      {t('warningDays', { n: cat.default_warning_days })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => handleDelete(cat.id)}
                  disabled={deleting === cat.id}
                >
                  {deleting === cat.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
