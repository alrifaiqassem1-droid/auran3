'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnMapping } from '@/lib/pos/parse-csv';

interface Props {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

type MappingKey = keyof ColumnMapping;

const FIELD_KEYS: MappingKey[] = ['barcode', 'product_name', 'quantity', 'total', 'sold_at'];

export function ColumnMapper({ headers, mapping, onChange }: Props) {
  const t = useTranslations('Import');

  function set(key: MappingKey, value: string) {
    onChange({ ...mapping, [key]: value === '__none__' ? null : value });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{t('mapColumns')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELD_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
              {t(`field_${key}`)}
            </span>
            <Select
              value={mapping[key] ?? '__none__'}
              onValueChange={(v) => set(key, v)}
            >
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— {t('skip')} —</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h} className="text-xs">
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
