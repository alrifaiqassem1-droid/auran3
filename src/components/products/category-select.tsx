'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslations } from 'next-intl';

interface Category {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  value: string;
  onChange: (val: string) => void;
}

export function CategorySelect({ categories, value, onChange }: Props) {
  const t = useTranslations('Products');

  return (
    <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger>
        <SelectValue placeholder={t('selectCategory')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{t('noCategory')}</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
