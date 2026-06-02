'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  suppliers: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function SupplierSelect({ suppliers, value, onChange }: Props) {
  const t = useTranslations('Receiving');

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t('supplier')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{t('noSupplier')}</SelectItem>
        {suppliers.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
