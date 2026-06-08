/**
 * AURAN Import Engine — Plugin Architecture
 *
 * كل Adapter مستقل تماماً ويُخرج نفس الـ PosImportRow[].
 * لإضافة adapter جديد: أنشئ AdapterDef واستدعِ importEngine.register().
 */

export interface PosImportRow {
  product_id:   string | null;
  barcode:      string | null;
  quantity:     number;
  total:        number;
  sold_at:      string | null;
}

export interface AdapterSubmitPayload {
  rows:      PosImportRow[];
  fileName:  string;
  source:    string;
}

/** تعريف الـ Adapter — يُسجَّل في engine ويُعرَض في الـ UI تلقائياً */
export interface AdapterDef {
  id:          string;
  nameKey:     string;   // مفتاح ترجمة في namespace Import
  descKey:     string;
  icon:        string;   // اسم أيقونة lucide-react
  available:   boolean;  // false = placeholder "قريباً"
}

class ImportEngine {
  private readonly _adapters: AdapterDef[] = [];

  register(def: AdapterDef) {
    if (!this._adapters.find((a) => a.id === def.id)) {
      this._adapters.push(def);
    }
  }

  get adapters(): readonly AdapterDef[] { return this._adapters; }
  get(id: string) { return this._adapters.find((a) => a.id === id); }
}

export const importEngine = new ImportEngine();

// ── Register all adapters ────────────────────────────────────────────────────

importEngine.register({
  id: 'csv', nameKey: 'adapterCsvName', descKey: 'adapterCsvDesc',
  icon: 'FileSpreadsheet', available: true,
});

importEngine.register({
  id: 'manual', nameKey: 'adapterManualName', descKey: 'adapterManualDesc',
  icon: 'PenLine', available: true,
});

importEngine.register({
  id: 'webhook', nameKey: 'adapterWebhookName', descKey: 'adapterWebhookDesc',
  icon: 'Webhook', available: true,
});

importEngine.register({
  id: 'foodic', nameKey: 'adapterFoodicName', descKey: 'adapterFoodicDesc',
  icon: 'UtensilsCrossed', available: false,
});
