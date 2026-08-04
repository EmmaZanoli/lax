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

const NAME_HINTS = ['cognome e nome', 'nome', 'name', 'buyer', 'cliente', 'nominativo', 'cognome', 'acquirente'];
const PHONE_HINTS = ['telefono', 'phone', 'cellulare', 'cell', 'whatsapp', 'mobile', 'tel.'];
const EMAIL_HINTS = ['indirizzo email', 'email', 'e-mail', 'posta elettronica'];

/**
 * Numero di catalogo dedotto da un'intestazione-prodotto.
 * Le colonne-prodotto del foglio risposte iniziano SEMPRE con «numero.» (es.
 * "1. INTERO Kallrökt…", "12. Pepparrots…"): quell'intero iniziale È il numero
 * di catalogo, ed è l'unico aggancio affidabile. Le etichette contengono tab,
 * spazi finali e descrizioni incoerenti (es. il prodotto 6 ha la descrizione
 * duplicata/garbled), quindi NON si abbina mai per nome.
 * Ritorna null se l'intestazione non inizia con «numero.».
 */
export function leadingProductNumber(header: string): number | null {
  const m = header.match(/^\s*(\d+)\s*\./);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) ? n : null;
}

/**
 * Deduce una mappatura iniziale dalle sole intestazioni.
 * - Prodotti: SOLO per numero iniziale dell'etichetta (`^\d+.`), agganciato a
 *   quel numero di catalogo. Nessun abbinamento per nome svedese.
 * - Contatti: email / nome / telefono per parole chiave.
 * - Tutto il resto (timestamp "Informazioni cronologiche", le diramazioni
 *   "Vuoi ordinare anche altri prodotti?" con eventuale suffisso, "Commenti",
 *   e qualsiasi etichetta che non inizi con «numero.») → ignora.
 */
export function autoMap(columns: string[], _catalog: Product[]): Mapping {
  let nameTaken = false;
  let phoneTaken = false;
  let emailTaken = false;
  const usedProducts = new Set<number>();

  return columns.map((col): ColumnRole => {
    const h = norm(col);
    if (!h) return { kind: 'ignore' };

    // Prodotto: aggancio primario per numero iniziale, prima di ogni altra regola.
    const num = leadingProductNumber(col);
    if (num != null) {
      if (usedProducts.has(num)) return { kind: 'ignore' };
      usedProducts.add(num);
      return { kind: 'product', number: num };
    }

    if (!emailTaken && EMAIL_HINTS.some((k) => h.includes(k))) {
      emailTaken = true;
      return { kind: 'email' };
    }
    if (!nameTaken && NAME_HINTS.some((k) => h.includes(k))) {
      nameTaken = true;
      return { kind: 'name' };
    }
    if (!phoneTaken && PHONE_HINTS.some((k) => h.includes(k))) {
      phoneTaken = true;
      return { kind: 'phone' };
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

/** Numeri-prodotto mappati ma assenti dal catalogo (di norma vuoto: il form ha solo 1–12). */
export function unknownProductNumbers(mapping: Mapping, catalog: Product[]): number[] {
  const known = new Set(catalog.map((p) => p.number));
  const out: number[] = [];
  for (const r of mapping) {
    if (r.kind === 'product' && !known.has(r.number) && !out.includes(r.number)) {
      out.push(r.number);
    }
  }
  return out;
}

/**
 * Interpreta una quantità dal campo (testo libero del form); null se non numerica.
 * Regole: vuoto/None ⇒ trattato dal chiamante come 0; "00" ⇒ 0; " 2 " ⇒ 2; "3" ⇒ 3.
 */
export function parseQuantity(raw: string): number | null {
  const cleaned = raw.replace(',', '.').replace(/\s/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Costruisce le bozze di buyer a partire da tabella + mappatura + catalogo.
 * I prezzi vengono SEMPRE dal catalogo; eventuali totali nel file sono ignorati.
 * I nomi duplicati vengono segnalati (mai uniti) per revisione manuale.
 */
export function buildDrafts(
  table: ParsedTable,
  mapping: Mapping,
  catalog: Product[],
): DraftRow[] {
  const nameIdx = mapping.findIndex((r) => r.kind === 'name');
  const phoneIdx = mapping.findIndex((r) => r.kind === 'phone');
  const emailIdx = mapping.findIndex((r) => r.kind === 'email');
  const productCols = mapping
    .map((r, idx) => ({ r, idx }))
    .filter((x): x is { r: Extract<ColumnRole, { kind: 'product' }>; idx: number } => x.r.kind === 'product');
  const priceByNumber = new Map(catalog.map((p) => [p.number, p.price]));

  const drafts = table.rows.map((cells): DraftRow => {
    const issues: RowIssue[] = [];
    const name = nameIdx >= 0 ? (cells[nameIdx] ?? '').trim() : '';
    const phone = phoneIdx >= 0 ? (cells[phoneIdx] ?? '').trim() : '';
    const email = emailIdx >= 0 ? (cells[emailIdx] ?? '').trim() : '';
    if (!name) issues.push({ type: 'name-missing' });

    const order: Record<number, number> = {};
    let pieces = 0;
    for (const { r, idx } of productCols) {
      const raw = (cells[idx] ?? '').trim();
      if (raw === '') continue; // cella vuota/saltata dalle diramazioni ⇒ 0
      const qty = parseQuantity(raw);
      if (qty == null) {
        // testo non convertibile a numero: segnala, non bloccare.
        issues.push({ type: 'bad-quantity', column: table.columns[idx] || `Colonna ${idx + 1}`, value: raw });
        continue;
      }
      if (qty <= 0) continue; // "0"/"00" ⇒ nessun pezzo
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
        email: email || undefined,
        order,
        pickedUp: false,
        payment: 'none',
        kind: 'customer',
      },
      total,
      pieces,
      issues,
      valid: name !== '',
    };
  });

  // Segnala i nomi duplicati (possibile doppio invio). Mai unire in automatico.
  const counts = new Map<string, number>();
  for (const d of drafts) {
    const key = norm(d.buyer.name);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const d of drafts) {
    const key = norm(d.buyer.name);
    const c = key ? (counts.get(key) ?? 0) : 0;
    if (c > 1) d.issues.push({ type: 'duplicate-name', count: c });
  }

  return drafts;
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
