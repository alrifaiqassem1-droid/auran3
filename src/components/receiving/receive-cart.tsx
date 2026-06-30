'use client';

import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  X,
  ScanLine,
  PenLine,
  RotateCcw,
  Package,
  PlusCircle,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatAED } from '@/lib/pricing';
import { enqueueAndRun } from '@/lib/offline/queue';
import { lookupProduct } from '@/lib/scan/lookup-product';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { useCelebration } from '@/hooks/use-celebration';
import { SupplierSelect } from './supplier-select';
import { ReceiveLine, type CartItem } from './receive-line';
import { ProductForm } from '@/components/products/product-form';
import { ScannerLayout, type ScannerProduct } from '@/components/scanner/scanner-layout';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductRow = {
  id: string;
  name: string;
  unit: 'pcs' | 'kg';
  barcode: string | null;
  cost_price: number;
};

// ─── Item Detail Sheet ────────────────────────────────────────────────────────

function ItemDetailSheet({
  open,
  onOpenChange,
  product,
  initial,
  isEditing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ProductRow | null;
  initial: Partial<CartItem>;
  isEditing: boolean;
  onConfirm: (item: CartItem) => void;
}) {
  const t = useTranslations('Receiving');
  const [qty,    setQty]    = useState(1);
  const [unit,   setUnit]   = useState<'pcs' | 'kg'>('pcs');
  const [cost,   setCost]   = useState(0);
  const [expiry, setExpiry] = useState('');
  const [lot,    setLot]    = useState('');

  useEffect(() => {
    if (open && product) {
      setQty(initial.quantity ?? 1);
      setUnit(initial.unit ?? product.unit);
      setCost(initial.cost_price ?? product.cost_price ?? 0);
      setExpiry(initial.expiry_date ?? '');
      setLot(initial.lot_number ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isKg   = unit === 'kg';
  const step   = isKg ? 0.1 : 1;
  const minQty = isKg ? 0.1 : 1;
  const total  = qty * cost;

  function decrement() { setQty((q) => parseFloat(Math.max(minQty, q - step).toFixed(3))); }
  function increment() { setQty((q) => parseFloat((q + step).toFixed(3))); }

  function handleConfirm() {
    if (!product) return;
    onConfirm({
      product_id:   product.id,
      product_name: product.name,
      unit,
      quantity:     qty > 0 ? qty : minQty,
      cost_price:   cost >= 0 ? cost : 0,
      expiry_date:  expiry || null,
      lot_number:   lot.trim() || null,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-[24px] pb-8">
        <SheetHeader className="mb-5">
          <SheetTitle className="truncate">{product?.name ?? ''}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-4">
          {/* Quantity + unit toggle */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('quantity')}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={decrement}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 active:scale-95 transition-transform"
              >
                <Minus className="h-4 w-4" />
              </button>
              <Input
                type="number"
                inputMode={isKg ? 'decimal' : 'numeric'}
                step={step}
                min={minQty}
                value={qty}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = isKg ? parseFloat(e.target.value) : parseInt(e.target.value, 10) || 0;
                  if (!isNaN(v)) setQty(Math.max(minQty, v));
                }}
                className="h-11 flex-1 text-center text-base font-bold tabular-nums"
              />
              <button
                onClick={increment}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 active:scale-95 transition-transform"
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="flex shrink-0 overflow-hidden rounded-xl border border-border/60">
                <button
                  onClick={() => { setUnit('pcs'); if (isKg) setQty(1); }}
                  className={cn(
                    'px-3 py-2.5 text-xs font-semibold transition-colors',
                    unit === 'pcs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  pcs
                </button>
                <button
                  onClick={() => { setUnit('kg'); if (!isKg) setQty(1); }}
                  className={cn(
                    'px-3 py-2.5 text-xs font-semibold transition-colors',
                    unit === 'kg' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  kg
                </button>
              </div>
            </div>
          </div>

          {/* Cost price */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('costPrice')}
              </p>
              <p className="text-xs text-muted-foreground">
                Total:{' '}
                <span className="font-semibold text-foreground tabular-nums">{formatAED(total)}</span>
              </p>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
                AED
              </span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={cost}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                className="h-11 ps-12 tabular-nums"
              />
            </div>
          </div>

          {/* Expiry date */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('expiryDate')}{' '}
              <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
            </p>
            <Input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Lot / Batch */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lot / Batch #{' '}
              <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
            </p>
            <Input
              type="text"
              placeholder="e.g. LOT-2024-001"
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              className="h-11"
            />
          </div>

          <Button className="h-12 w-full rounded-xl text-sm font-semibold" onClick={handleConfirm}>
            {isEditing ? 'Update item' : t('addToList')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Add Manually Sheet ───────────────────────────────────────────────────────

function AddManuallySheet({
  open,
  onOpenChange,
  products,
  onSelect,
  onCreateProduct,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: ProductRow[];
  onSelect: (product: ProductRow) => void;
  onCreateProduct: (searchTerm: string) => void;
}) {
  const t = useTranslations('Receiving');
  const [search, setSearch] = useState('');

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search)),
  );

  function reset() { setSearch(''); }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[24px] pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('manualAddTitle')}</SheetTitle>
        </SheetHeader>

        <Input
          autoFocus
          placeholder={t('selectProductPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />

        <div className="max-h-64 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t('noProducts')}</p>
              {search.trim() && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 rounded-xl"
                  onClick={() => { const term = search.trim(); reset(); onOpenChange(false); onCreateProduct(term); }}
                >
                  <PlusCircle className="h-4 w-4" />
                  Add new product
                </Button>
              )}
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => { reset(); onOpenChange(false); onSelect(p); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40 active:bg-muted/60"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  {p.barcode && (
                    <p className="font-mono text-[11px] text-muted-foreground">{p.barcode}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 uppercase">
                  {p.unit}
                </Badge>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── ReceiveCart ──────────────────────────────────────────────────────────────

interface Props {
  suppliers:          { id: string; name: string }[];
  categories:         { id: string; name: string }[];
  products:           ProductRow[];
  initialBarcode?:    string | null;
  initialSupplierId?: string;
  initialReference?:  string;
}

export function ReceiveCart({ suppliers, categories, products, initialBarcode, initialSupplierId, initialReference }: Props) {
  const t = useTranslations('Receiving');
  const { activeBranchId, activeMembership } = useActiveBranch();
  const { celebrate } = useCelebration();
  const router  = useRouter();
  const reduced = useReducedMotion();

  const [cart,            setCart]            = useState<CartItem[]>([]);
  const [supplierId,      setSupplierId]      = useState(initialSupplierId ?? '');
  const [reference,       setReference]       = useState(initialReference ?? '');
  const [showScanner,     setShowScanner]     = useState(false);
  const [showManual,      setShowManual]      = useState(false);
  const [isConfirming,    setIsConfirming]    = useState(false);
  const [pendingBarcode,  setPendingBarcode]  = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  // Detail sheet state
  const [showDetail,    setShowDetail]    = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductRow | null>(null);
  const [detailInitial, setDetailInitial] = useState<Partial<CartItem>>({});
  const [editingIndex,  setEditingIndex]  = useState<number | null>(null);

  const initDone    = useRef(false);
  const isLookingUp = useRef(false);
  const tenantId = activeMembership?.tenant_id;

  // ── Open detail sheet for a new item ─────────────────────────────────────
  function openDetail(product: ProductRow, initial: Partial<CartItem> = {}) {
    setDetailProduct(product);
    setDetailInitial({ cost_price: product.cost_price, unit: product.unit, ...initial });
    setEditingIndex(null);
    setShowDetail(true);
  }

  // ── Open detail sheet to edit an existing line ────────────────────────────
  function openDetailEdit(index: number) {
    const line = cart[index];
    setDetailProduct(
      products.find((p) => p.id === line.product_id) ?? {
        id: line.product_id, name: line.product_name,
        unit: line.unit, barcode: null, cost_price: line.cost_price,
      },
    );
    setDetailInitial(line);
    setEditingIndex(index);
    setShowDetail(true);
  }

  // ── Confirm from detail sheet ─────────────────────────────────────────────
  function handleDetailConfirm(item: CartItem) {
    if (editingIndex !== null) updateLine(editingIndex, item);
    else addLine(item);
    setShowDetail(false);
    setDetailProduct(null);
    setEditingIndex(null);
  }

  // ── Add a line (merges duplicate) ─────────────────────────────────────────
  function addLine(item: CartItem) {
    setCart((prev) => {
      const lastIdx = prev.map((l) => l.product_id).lastIndexOf(item.product_id);
      if (lastIdx !== -1) {
        toast.info(t('duplicateScan'));
        return prev.map((l, i) => i === lastIdx ? { ...l, quantity: l.quantity + item.quantity } : l);
      }
      return [...prev, item];
    });
  }

  // ── Initial barcode from URL ──────────────────────────────────────────────
  useEffect(() => {
    if (initDone.current || !initialBarcode || !tenantId) return;
    initDone.current = true;
    lookupProduct(initialBarcode, tenantId).then((product) => {
      if (product) {
        openDetail({
          id: product.id, name: product.name,
          unit: product.unit as 'pcs' | 'kg',
          barcode: initialBarcode,
          cost_price: (product.cost_price as number) ?? 0,
        });
      } else {
        setPendingBarcode(initialBarcode);
        setShowProductForm(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBarcode, tenantId]);

  // ── Scanner callback (via ScannerLayout) ──────────────────────────────────
  const handleScanned = useCallback(
    (barcode: string) => {
      if (isLookingUp.current) return;
      isLookingUp.current = true;
      setShowScanner(false);
      if (!tenantId) { isLookingUp.current = false; return; }
      lookupProduct(barcode, tenantId)
        .then((product) => {
          if (product) {
            openDetail({
              id: product.id, name: product.name,
              unit: product.unit as 'pcs' | 'kg',
              barcode,
              cost_price: (product.cost_price as number) ?? 0,
            });
          } else {
            setPendingBarcode(barcode);
            setShowProductForm(true);
          }
        })
        .finally(() => { isLookingUp.current = false; });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId],
  );

  // ── Product selected from scanner search ──────────────────────────────────
  function handleScannerProductSelect(p: ScannerProduct) {
    setShowScanner(false);
    openDetail({ id: p.id, name: p.name, unit: p.unit, barcode: p.barcode, cost_price: p.cost_price });
  }

  // ── Product selected from manual sheet ────────────────────────────────────
  function handleManualSelect(product: ProductRow) { openDetail(product); }

  function handleManualCreate(searchTerm: string) {
    const looksLikeBarcode = searchTerm.length >= 4 && !/\s/.test(searchTerm);
    setPendingBarcode(looksLikeBarcode ? searchTerm : null);
    setShowProductForm(true);
  }

  // ── After ProductForm closes ──────────────────────────────────────────────
  function handleProductFormClose(open: boolean) {
    if (!open) {
      setShowProductForm(false);
      if (pendingBarcode && tenantId) {
        const barcode = pendingBarcode;
        setPendingBarcode(null);
        lookupProduct(barcode, tenantId).then((p) => {
          if (p) openDetail({ id: p.id, name: p.name, unit: p.unit as 'pcs' | 'kg', barcode, cost_price: (p.cost_price as number) ?? 0 });
        });
      } else {
        setPendingBarcode(null);
      }
    }
  }

  // ── Line update / remove ──────────────────────────────────────────────────
  function updateLine(index: number, updated: Partial<CartItem>) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, ...updated } : l)));
  }
  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Confirm receipt ───────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!activeBranchId || cart.length === 0) return;
    setIsConfirming(true);
    try {
      const res = await enqueueAndRun('receive_goods', {
        branch_id:   activeBranchId,
        supplier_id: supplierId && supplierId !== '__none__' ? supplierId : null,
        reference:   reference.trim() || null,
        lines: cart.map((l) => ({
          product_id:  l.product_id,
          quantity:    l.quantity,
          cost_price:  l.cost_price,
          expiry_date: l.expiry_date || null,
          lot_number:  l.lot_number || null,
        })),
      });

      if (res.ok && !res.queued) {
        celebrate();
        toast.success(t('confirmSuccess'));
      } else if (res.ok && res.queued) {
        toast.success(t('confirmOffline'));
      } else {
        toast.error(res.error ?? 'فشل الاستلام');
        return;
      }

      setCart([]); setSupplierId(''); setReference('');
      router.refresh();
    } finally {
      setIsConfirming(false);
    }
  }

  const totalCost = cart.reduce((s, l) => s + l.quantity * l.cost_price, 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Sticky action bar */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex gap-2 border-b border-border/40 bg-background/95 px-4 pb-3 pt-2 backdrop-blur-md">
        <Button
          className="h-12 flex-1 gap-2 rounded-xl shadow-md shadow-primary/20"
          onClick={() => setShowScanner(true)}
        >
          <ScanLine className="h-4 w-4 shrink-0" />
          {t('scanToAdd')}
        </Button>
        <Button
          variant="outline"
          className="h-12 flex-1 gap-2 rounded-xl"
          onClick={() => setShowManual(true)}
        >
          <PenLine className="h-4 w-4 shrink-0" />
          {t('addManually')}
        </Button>
      </div>

      {/* Supplier + Reference */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <SupplierSelect suppliers={suppliers} value={supplierId} onChange={setSupplierId} />
        <Input
          placeholder={t('referencePlaceholder')}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      {/* Items list */}
      {cart.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 py-12 text-center"
        >
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">{t('cartEmpty')}</p>
          <p className="text-xs text-muted-foreground/60">{t('cartEmptyDesc')}</p>
        </motion.div>
      ) : (
        <div className="mb-4 space-y-2">
          <AnimatePresence initial={false}>
            {cart.map((line, index) => (
              <motion.div
                key={`${line.product_id}-${index}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 48, transition: { duration: 0.18 } }}
                transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <ReceiveLine
                  line={line}
                  onEdit={() => openDetailEdit(index)}
                  onRemove={() => removeLine(index)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Summary */}
          <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">{t('lineCount', { n: cart.length })}</span>
            <span className="text-lg font-bold tabular-nums">{formatAED(totalCost)}</span>
          </div>
        </div>
      )}

      {/* Confirm button */}
      <div className="pb-6">
        <Button
          className="h-12 w-full rounded-xl text-sm font-semibold"
          disabled={isConfirming || cart.length === 0}
          onClick={handleConfirm}
        >
          {isConfirming ? (
            <span className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 animate-spin" />
              {t('confirming')}
            </span>
          ) : (
            t('confirmReceipt')
          )}
        </Button>
      </div>

      {/* Scanner overlay — uses shared ScannerLayout */}
      {showScanner && (
        <ScannerLayout
          mode="receive"
          title={t('scannerTitle')}
          onScanned={handleScanned}
          onProductSelect={handleScannerProductSelect}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Add manually sheet */}
      <AddManuallySheet
        open={showManual}
        onOpenChange={setShowManual}
        products={products}
        onSelect={handleManualSelect}
        onCreateProduct={handleManualCreate}
      />

      {/* Item detail sheet */}
      <ItemDetailSheet
        open={showDetail}
        onOpenChange={setShowDetail}
        product={detailProduct}
        initial={detailInitial}
        isEditing={editingIndex !== null}
        onConfirm={handleDetailConfirm}
      />

      {/* Product creation form */}
      <ProductForm
        open={showProductForm}
        onOpenChange={handleProductFormClose}
        categories={categories}
        prefillBarcode={pendingBarcode ?? undefined}
        variant="sheet"
      />
    </>
  );
}
