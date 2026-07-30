import type { Product } from '../types';
import type {
  ColumnRole,
  DraftRow,
  Mapping,
  ParsedTable,
  ReconcileRow,
  RowIssue,
} from './types';

/** Normalizzazione leggera per il confronto testuale delle intestazioni. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

const NAME_HINTS = ['nome', 'name', 'buyer', 'cliente', 'nominativo', 'cognome', 'acquirente'];
const PHONE_HINTS = ['telefono', 'phone', 'cellulare', 'cell', 'whatsapp', 'mobile', 'tel.'];
const IGNORE_HINTS = [
  'timestamp',
  'informazioni cronologiche',
  'email',
  'e-mail',
  'indirizzo email',
  'totale',
  'total',
  'prezzo',
  'importo',
];

/** Cerca nell'intestazione un numero che corrisponda a un prodotto di catalogo. */
function matchByNumber(header: string, numbers: Set<number>): number | null {
  const found = header.match(/\d+/g);
  if (!found) return null;
  for (const m of found) {
    const n = Number(m);
    if (numbers.has(n)) return n;
  }
  return null;
}

/** Abbina l'intestazione a un prodotto per nome svedese (match più specifico). */
function matchBySwedishName(header: string, catalog: Product[]): number | null {
  const h = norm(header);
  if (!h) return null;
  let best: { number: number; len: number } | null = null;
  for (const p of catalog) {
    const sv = norm(p.nameSv);
    if (!sv) continue;
    const hit =
      h === sv ||
      (sv.length >= 3 && h.includes(sv)) ||
      (h.length >= 3 && sv.includes(h));
    if (hit && (!best || sv.length > best.len)) best = { number: p.number, len: sv.length };
  }
  return best?.number ?? null;
}

/**
 * Deduce una mappatura iniziale dalle sole intestazioni:
 * nome/telefono per parole chiave, prodotti prima per NUMERO poi per nome svedese.
 */
export function autoMap(columns: string[], catalog: Product[]): Mapping {
  const numbers = new Set(catalog.map((p) => p.number));
  let nameTaken = false;
  let phoneTaken = false;
  const usedProducts = new Set<number>();

  return columns.map((col): ColumnRole => {
    const h = norm(col);
    if (!h) return { kind: 'ignore' };
    if (IGNORE_HINTS.some((k) => h.includes(k))) return { kind: 'ignore' };
    if (!nameTaken && NAME_HINTS.some((k) => h.includes(k))) {
      nameTaken = true;
      return { kind: 'name' };
    }
    if (!phoneTaken && PHONE_HINTS.some((k) => h.includes(k))) {
      phoneTaken = true;
      return { kind: 'phone' };
    }
    const byNumber = matchByNumber(col, numbers);
    if (byNumber != null && !usedProducts.has(byNumber)) {
      usedProducts.add(byNumber);
      return { kind: 'product', number: byNumber };
    }
    const byName = matchBySwedishName(col, catalog);
    if (byName != null && !usedProducts.has(byName)) {
      usedProducts.add(byName);
      return { kind: 'product', number: byName };
    }
    return { kind: 'ignore' };
  });
}

/** Un ruolo salvato è valido se non punta a un prodotto sparito dal catalogo. */
function isValidRole(role: ColumnRole, numbers: Set<number>): boolean {
  return role.kind !== 'product' || numbers.has(role.number);
}

/**
 * Mappatura iniziale: parte dall'auto-riconoscimento e sovrascrive con la
 * mappatura salvata (per colonna) quando presente e ancora valida.
 */
export function buildInitialMapping(
  columns: string[],
  catalog: Product[],
  saved: Record<string, ColumnRole> | null,
): Mapping {
  const mapping = autoMap(columns, catalog);
  if (saved) {
    const numbers = new Set(catalog.map((p) => p.number));
    columns.forEach((col, i) => {
      const role = saved[col];
      if (role && isValidRole(role, numbers)) mapping[i] = role;
    });
  }
  return mapping;
}

/** Interpreta una quantità; null se non numerica. */
export function parseQuantity(raw: string): number | null {
  const cleaned = raw.replace(',', '.').replace(/\s/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Costruisce le bozze di buyer a partire da tabella + mappatura + catalogo.
 * I prezzi vengono SEMPRE dal catalogo; eventuali totali nel file sono ignorati.
 */
export function buildDrafts(
  table: ParsedTable,
  mapping: Mapping,
  catalog: Product[],
): DraftRow[] {
  const nameIdx = mapping.findIndex((r) => r.kind === 'name');
  const phoneIdx = mapping.findIndex((r) => r.kind === 'phone');
  const productCols = mapping
    .map((r, idx) => ({ r, idx }))
    .filter((x): x is { r: Extract<ColumnRole, { kind: 'product' }>; idx: number } => x.r.kind === 'product');
  const priceByNumber = new Map(catalog.map((p) => [p.number, p.price]));

  return table.rows.map((cells): DraftRow => {
    const issues: RowIssue[] = [];
    const name = nameIdx >= 0 ? (cells[nameIdx] ?? '').trim() : '';
    const phone = phoneIdx >= 0 ? (cells[phoneIdx] ?? '').trim() : '';
    if (!name) issues.push({ type: 'name-missing' });

    const order: Record<number, number> = {};
    let pieces = 0;
    for (const { r, idx } of productCols) {
      const raw = (cells[idx] ?? '').trim();
      if (raw === '') continue;
      const qty = parseQuantity(raw);
      if (qty == null) {
        issues.push({ type: 'bad-quantity', column: table.columns[idx] || `Colonna ${idx + 1}`, value: raw });
        continue;
      }
      if (qty <= 0) continue;
      order[r.number] = (order[r.number] ?? 0) + qty;
      pieces += qty;
    }

    let total = 0;
    for (const [num, q] of Object.entries(order)) {
      total += q * (priceByNumber.get(Number(num)) ?? 0);
    }

    const id = crypto.randomUUID();
    return {
      id,
      buyer: {
        id,
        name,
        phone: phone || undefined,
        order,
        pickedUp: false,
        payment: 'none',
      },
      total,
      pieces,
      issues,
      valid: name !== '',
    };
  });
}

/** Ordinato per prodotto vs giacenza iniziale, per la riconciliazione. */
export function reconcile(drafts: DraftRow[], catalog: Product[]): ReconcileRow[] {
  const orderedByNumber = new Map<number, number>();
  for (const d of drafts) {
    if (!d.valid) continue;
    for (const [num, q] of Object.entries(d.buyer.order)) {
      const n = Number(num);
      orderedByNumber.set(n, (orderedByNumber.get(n) ?? 0) + q);
    }
  }
  return catalog.map((p) => {
    const ordered = orderedByNumber.get(p.number) ?? 0;
    return {
      number: p.number,
      nameSv: p.nameSv,
      ordered,
      initialStock: p.initialStock,
      delta: p.initialStock - ordered,
    };
  });
}

/** Firma del formato: intestazioni normalizzate. Serve a riconoscere lo stesso file. */
export function signature(columns: string[]): string {
  return columns.map((c) => norm(c)).join('|');
}
