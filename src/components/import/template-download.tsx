'use client';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TEMPLATE_HEADERS = ['barcode', 'product_name', 'quantity', 'total', 'sold_at'];
const SAMPLE_ROW        = ['6281234567890', 'لحم بقري', '2', '35.00', '2026-06-01 10:30'];

export function TemplateDownload() {
  const t = useTranslations('Import');

  function download() {
    const csv = [TEMPLATE_HEADERS, SAMPLE_ROW].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'auran-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="ghost" size="sm" onClick={download} className="h-8 gap-1.5 text-xs text-muted-foreground">
      <Download className="h-3.5 w-3.5" />
      {t('downloadTemplate')}
    </Button>
  );
}
