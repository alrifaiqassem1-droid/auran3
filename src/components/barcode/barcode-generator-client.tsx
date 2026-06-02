'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type BarcodeFormat = 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'qrcode';

interface Product { id: string; name: string; barcode: string | null }

interface Props {
  products: Product[];
  companyName: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function BarcodeGeneratorClient({ products, companyName: initCompany }: Props) {
  const t = useTranslations('BarcodeGenerator');

  const FORMATS: { value: BarcodeFormat; label: string; hint?: string }[] = [
    { value: 'EAN13',   label: 'EAN-13',   hint: t('ean13Hint') },
    { value: 'EAN8',    label: 'EAN-8',    hint: t('ean8Hint')  },
    { value: 'CODE128', label: 'Code-128'                        },
    { value: 'qrcode',  label: 'QR Code'                         },
    { value: 'UPC',     label: 'UPC-A',    hint: t('upcHint')   },
  ];

  const [format, setFormat]         = useState<BarcodeFormat>('CODE128');
  const [value, setValue]           = useState('');
  const [selProduct, setSelProduct] = useState<Product | null>(null);
  const [comboOpen, setComboOpen]   = useState(false);
  const [company, setCompany]       = useState(initCompany);
  const [price, setPrice]           = useState('');
  const [size, setSize]             = useState(2);
  const [fgColor, setFgColor]       = useState('#000000');
  const [bgColor, setBgColor]       = useState('#ffffff');
  const [showText, setShowText]     = useState(true);
  const [copies, setCopies]         = useState(1);
  const [renderError, setRenderError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trimmed = value.trim();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!trimmed) {
      const ctx = canvas.getContext('2d');
      if (ctx) { canvas.width = 200; canvas.height = 80; ctx.clearRect(0, 0, 200, 80); }
      setRenderError('');
      return;
    }

    let dead = false;
    setRenderError('');

    if (format === 'qrcode') {
      import('qrcode').then(({ default: QRCode }) => {
        if (dead || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, trimmed, {
          width: Math.round(size * 80),
          color: { dark: fgColor, light: bgColor },
          margin: 2,
          errorCorrectionLevel: 'M',
        }, (err) => { if (!dead && err) setRenderError(err.message); });
      });
    } else {
      import('jsbarcode').then(({ default: JsBarcode }) => {
        if (dead || !canvasRef.current) return;
        try {
          JsBarcode(canvasRef.current, trimmed, {
            format,
            lineColor: fgColor,
            background: bgColor,
            displayValue: showText,
            width: size,
            height: 80,
            margin: 10,
          });
        } catch (e: unknown) {
          if (!dead) setRenderError((e as Error)?.message ?? 'Render error');
        }
      });
    }

    return () => { dead = true; };
  }, [format, trimmed, size, fgColor, bgColor, showText]);

  function pickProduct(p: Product) {
    setSelProduct(p);
    if (p.barcode) setValue(p.barcode);
    setComboOpen(false);
  }

  function handlePrint() {
    const canvas = canvasRef.current;
    if (!canvas || !trimmed || renderError) return;

    const img = canvas.toDataURL('image/png');
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const label = `
      <div class="label">
        ${company ? `<div class="co">${company}</div>` : ''}
        <img src="${img}" alt="barcode">
        ${price ? `<div class="pr">${price}</div>` : ''}
      </div>`;

    win.document.write(`<!DOCTYPE html>
<html dir="${document.documentElement.dir}" lang="${document.documentElement.lang}">
<head><meta charset="UTF-8"><title>${t('printTitle')}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#fff}
.grid{display:flex;flex-wrap:wrap;gap:3mm;padding:8mm}
.label{border:.5px dashed #bbb;padding:3mm;text-align:center;break-inside:avoid}
.co{font-size:9pt;font-weight:700;margin-bottom:2mm}
img{display:block;max-width:100%}
.pr{font-size:10pt;font-weight:700;margin-top:2mm}
@media print{@page{margin:5mm}}
</style></head>
<body>
<div class="grid">${Array(copies).fill(label).join('')}</div>
<script>setTimeout(()=>{window.print();window.close()},400)<\/script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      {/* Barcode type */}
      <Section title={t('barcodeType')}>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={cn(
                'min-h-[44px] rounded-xl border px-3 py-2 text-start text-xs font-medium transition-colors',
                format === f.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              <div className="font-semibold">{f.label}</div>
              {f.hint && <div className="mt-0.5 opacity-60">{f.hint}</div>}
            </button>
          ))}
        </div>
      </Section>

      {/* Input data */}
      <Section title={t('inputSection')}>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('product')}</label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <button className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-sm">
                  <span className={selProduct ? 'text-foreground' : 'text-muted-foreground'}>
                    {selProduct?.name ?? t('selectProduct')}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-40" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('searchProduct')} />
                  <CommandList className="max-h-52">
                    <CommandEmpty>{t('noResults')}</CommandEmpty>
                    <CommandGroup>
                      {products.map((p) => (
                        <CommandItem key={p.id} value={p.name} onSelect={() => pickProduct(p)}>
                          <span className="flex-1">{p.name}</span>
                          {p.barcode && (
                            <span className="font-mono text-[10px] text-muted-foreground">{p.barcode}</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('barcodeValue')}</label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('valuePlaceholder')}
              dir="ltr"
              className="h-11"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('companyName')}</label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} className="h-11" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('price')}</label>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t('pricePlaceholder')}
              inputMode="decimal"
              dir="ltr"
              className="h-11"
            />
          </div>
        </div>
      </Section>

      {/* Live preview */}
      <Section title={t('preview')}>
        <div
          className="flex min-h-36 items-center justify-center overflow-auto rounded-xl p-4"
          style={{ background: bgColor, border: `1px solid ${fgColor}20` }}
        >
          {!trimmed && <p className="text-xs text-muted-foreground">{t('noValue')}</p>}
          {trimmed && renderError && (
            <p className="max-w-xs text-center text-xs text-destructive">{renderError}</p>
          )}
          <canvas ref={canvasRef} className={cn(!trimmed || renderError ? 'hidden' : '')} />
        </div>
      </Section>

      {/* Customization */}
      <Section title={t('customization')}>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">{t('size')}</label>
              <span className="tabular-nums text-xs text-muted-foreground">{size}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('fgColor')}</label>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-border px-3">
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="font-mono text-xs text-muted-foreground">{fgColor}</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('bgColor')}</label>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-border px-3">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="font-mono text-xs text-muted-foreground">{bgColor}</span>
              </div>
            </div>
          </div>

          {format !== 'qrcode' && (
            <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5">
              <span className="text-sm">{t('showText')}</span>
              <Switch checked={showText} onCheckedChange={setShowText} />
            </div>
          )}
        </div>
      </Section>

      {/* Print */}
      <Section title={t('printSection')}>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('copies')}</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              dir="ltr"
              className="h-11 w-28"
            />
          </div>
          <Button
            onClick={handlePrint}
            disabled={!trimmed || !!renderError}
            className="h-11 w-full gap-2 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
          >
            <Printer className="h-4 w-4" />
            {t('print')} • {copies} {t('copiesLabel')}
          </Button>
        </div>
      </Section>
    </div>
  );
}
