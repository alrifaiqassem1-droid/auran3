import Papa from 'papaparse';

export interface ParsedRow {
  [key: string]: string;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
  fileName: string;
}

export interface ColumnMapping {
  barcode: string | null;
  product_name: string | null;
  quantity: string | null;
  total: string | null;
  sold_at: string | null;
}

export interface MappedRow {
  _idx: number;
  barcode: string | null;
  product_name: string | null;
  quantity: number;
  total: number;
  sold_at: string | null;
}

const PATTERNS: Record<keyof ColumnMapping, string[]> = {
  barcode:      ['barcode', 'ean', 'upc', 'sku', 'code', 'item_code', 'product_code', 'رمز', 'باركود'],
  product_name: ['name', 'product', 'description', 'item', 'article', 'اسم', 'منتج'],
  quantity:     ['qty', 'quantity', 'units', 'count', 'pieces', 'كمية', 'عدد'],
  total:        ['total', 'revenue', 'amount', 'gross', 'sale', 'price', 'مبلغ', 'إجمالي', 'سعر'],
  sold_at:      ['date', 'sold_at', 'sale_date', 'time', 'datetime', 'created', 'تاريخ'],
};

export function detectColumns(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim().replace(/\s+/g, '_'));
  const find = (patterns: string[]) => {
    const idx = lower.findIndex((h) => patterns.some((p) => h.includes(p)));
    return idx >= 0 ? headers[idx] : null;
  };
  return {
    barcode:      find(PATTERNS.barcode),
    product_name: find(PATTERNS.product_name),
    quantity:     find(PATTERNS.quantity),
    total:        find(PATTERNS.total),
    sold_at:      find(PATTERNS.sold_at),
  };
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = (results.meta.fields ?? []).filter(Boolean);
        const rows = results.data as ParsedRow[];
        resolve({ headers, rows, totalRows: rows.length, fileName: file.name });
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}

export function applyMapping(rows: ParsedRow[], mapping: ColumnMapping): MappedRow[] {
  const get = (row: ParsedRow, col: string | null) =>
    col ? (row[col] ?? '').toString().trim() : '';

  return rows
    .map((row, idx) => {
      const qty = parseFloat(get(row, mapping.quantity).replace(/,/g, '')) || 0;
      const total = parseFloat(get(row, mapping.total).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
      return {
        _idx: idx,
        barcode:      get(row, mapping.barcode) || null,
        product_name: get(row, mapping.product_name) || null,
        quantity:     qty,
        total:        total,
        sold_at:      get(row, mapping.sold_at) || null,
      };
    })
    .filter((r) => r.quantity > 0);
}
