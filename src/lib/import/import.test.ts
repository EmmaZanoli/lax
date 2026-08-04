import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseCatalog } from '../catalog';
import type { Product } from '../types';
import {
  autoMap,
  buildDrafts,
  parseQuantity,
  reconcile,
  tableFromWorkbookBuffer,
  type Mapping,
  type ParsedTable,
} from './index';

// Sorgente UFFICIALE dell'import: l'export del foglio risposte del Google Form.
// La versione anonimizzata (nomi di fantasia unici, telefoni/email placeholder,
// quantità reali) vive nel root della repo. Il catalogo reale è /public/catalog.json.
const XLSX_PATH = fileURLToPath(new URL('../../../ordine.xlsx', import.meta.url));
const CATALOG_PATH = fileURLToPath(new URL('../../../public/catalog.json', import.meta.url));

const catalog: Product[] = parseCatalog(JSON.parse(readFileSync(CATALOG_PATH, 'utf8')));
const table = tableFromWorkbookBuffer(readFileSync(XLSX_PATH), 'ordine.xlsx');
const mapping = autoMap(table.columns, catalog);
const drafts = buildDrafts(table, mapping, catalog);

// Prezzo di catalogo per numero, per verificare i totali (mai dal foglio).
const price = new Map(catalog.map((p) => [p.number, p.price]));

describe('parseQuantity — pulizia delle quantità (testo libero del form)', () => {
  it('legge i numeri scritti come stringa, sporchi di spazi', () => {
    expect(parseQuantity('3')).toBe(3);
    expect(parseQuantity(' 2 ')).toBe(2);
  });
  it('legge "00" come 0', () => {
    expect(parseQuantity('00')).toBe(0);
  });
  it('ritorna null per vuoto o testo non numerico (segnalato, non crash)', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('due')).toBeNull();
  });
});

describe('autoMap — riconoscimento colonne del foglio risposte', () => {
  it('mappa i contatti: email, nome, telefono', () => {
    // Ordine reale delle colonne: A timestamp, B email, C nome, D telefono.
    expect(mapping[1]).toEqual({ kind: 'email' });
    expect(mapping[2]).toEqual({ kind: 'name' });
    expect(mapping[3]).toEqual({ kind: 'phone' });
  });

  it('aggancia le colonne-prodotto ai numeri di catalogo 1–12 (per numero, non per nome)', () => {
    const productNumbers = mapping
      .filter((r) => r.kind === 'product')
      .map((r) => (r as { number: number }).number)
      .sort((a, b) => a - b);
    expect(productNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('ignora timestamp, diramazioni "Vuoi ordinare…" e "Commenti"', () => {
    // Colonne di diramazione (indici 6, 9, 12, 15), timestamp (0) e commenti (20).
    for (const i of [0, 6, 9, 12, 15, 20]) {
      expect(mapping[i]).toEqual({ kind: 'ignore' });
    }
    // Nessuna colonna di diramazione deve essere stata scambiata per un prodotto
    // (l'etichetta "Vuoi ordinare…? 2" contiene un "2" ma non inizia con "numero.").
    for (const i of [6, 9, 12, 15]) {
      expect(table.columns[i].toLowerCase()).toContain('vuoi ordinare');
      expect(mapping[i].kind).toBe('ignore');
    }
  });
});

describe('buildDrafts — import del foglio reale', () => {
  it('importa 97 buyer, tutti validi (con nome)', () => {
    expect(table.rows.length).toBe(97);
    expect(drafts.length).toBe(97);
    expect(drafts.filter((d) => d.valid).length).toBe(97);
  });

  it('cattura l\'email di ogni buyer (campo opzionale)', () => {
    expect(drafts.every((d) => (d.buyer.email ?? '').includes('@'))).toBe(true);
    expect(drafts[0].buyer.email).toBeTruthy();
  });

  it('ogni ordine contiene solo numeri di catalogo 1–12 con quantità > 0', () => {
    for (const d of drafts) {
      for (const [num, qty] of Object.entries(d.buyer.order)) {
        expect(Number(num)).toBeGreaterThanOrEqual(1);
        expect(Number(num)).toBeLessThanOrEqual(12);
        expect(qty).toBeGreaterThan(0);
      }
    }
  });

  it('legge le celle vuote/saltate come 0 (prima riga: solo prodotto 1)', () => {
    // La prima riga ordina 1× prodotto 1, tutto il resto è vuoto ⇒ nessun'altra voce.
    expect(drafts[0].buyer.order).toEqual({ 1: 1 });
    expect(drafts[0].pieces).toBe(1);
  });

  it('legge la cella "00" come 0: quel prodotto non entra nell\'ordine', () => {
    // Trova nella tabella grezza l'unica cella "00" e la sua colonna-prodotto.
    let cellRow = -1;
    let cellCol = -1;
    table.rows.forEach((row, ri) =>
      row.forEach((c, ci) => {
        if (c.trim() === '00') {
          cellRow = ri;
          cellCol = ci;
        }
      }),
    );
    expect(cellRow).toBeGreaterThanOrEqual(0);
    const role = mapping[cellCol];
    expect(role.kind).toBe('product');
    const prodNum = (role as { number: number }).number;
    // "00" ⇒ 0 ⇒ il prodotto NON compare nell'ordine di quel buyer.
    expect(drafts[cellRow].buyer.order[prodNum]).toBeUndefined();
    // Nel foglio reale è la riga con ordine { 2:3, 6:1 } (prodotto 11 = "00").
    expect(prodNum).toBe(11);
    expect(drafts[cellRow].buyer.order).toEqual({ 2: 3, 6: 1 });
  });

  it('ricalcola i totali di riga dai prezzi di catalogo (mai dal foglio)', () => {
    // Riga 1: 1× prodotto 1 (54,00) = 54,00.
    expect(drafts[0].total).toBe(1 * price.get(1)!);
    expect(drafts[0].total).toBe(54);

    // Riga 3: 2× prodotto 2 (27,00) = 54,00.
    expect(drafts[2].buyer.order).toEqual({ 2: 2 });
    expect(drafts[2].total).toBe(2 * price.get(2)!);
    expect(drafts[2].total).toBe(54);

    // Riga con l'ordine più grande del foglio: verifica il totale composito.
    const big = drafts[64];
    expect(big.buyer.order).toEqual({ 1: 22, 2: 37, 3: 1, 4: 2, 5: 3, 6: 7, 8: 1, 10: 1 });
    const expected =
      22 * price.get(1)! +
      37 * price.get(2)! +
      1 * price.get(3)! +
      2 * price.get(4)! +
      3 * price.get(5)! +
      7 * price.get(6)! +
      1 * price.get(8)! +
      1 * price.get(10)!;
    expect(big.total).toBe(expected);
    expect(big.total).toBe(2676);
    expect(big.pieces).toBe(74);
  });

  it('nel foglio d\'esempio i 97 nomi di fantasia sono unici: nessun avviso di duplicato', () => {
    const withDup = drafts.filter((d) => d.issues.some((i) => i.type === 'duplicate-name'));
    expect(withDup.length).toBe(0);
    const names = drafts.map((d) => d.buyer.name.trim().toLowerCase());
    expect(names.every((n) => n !== '')).toBe(true);
    expect(new Set(names).size).toBe(97);
    expect(new Set(drafts.map((d) => d.buyer.id)).size).toBe(97);
  });
});

describe('buildDrafts — nomi duplicati (input sintetico)', () => {
  // Il foglio d'esempio ora ha nomi unici; la rilevazione dei duplicati (possibile
  // doppio invio) si verifica con un input costruito ad hoc: due righe stesso nome.
  const table: ParsedTable = {
    fileName: 'synth.csv',
    columns: ['Cognome e nome', '1. Prodotto'],
    rows: [
      ['Mario Rossi', '1'],
      ['MARIO  ROSSI', '2'], // stesso nome (case/spazi diversi) ⇒ duplicato
      ['Lucia Bianchi', '1'],
    ],
  };
  const mapping: Mapping = [{ kind: 'name' }, { kind: 'product', number: 1 }];
  const synth = buildDrafts(table, mapping, catalog);

  it('segnala le righe con nome duplicato (match case/spazi-insensitive), senza unirle', () => {
    // Le due righe "Mario Rossi" restano DUE buyer distinti, ciascuno segnalato.
    expect(synth.length).toBe(3);
    expect(new Set(synth.map((d) => d.buyer.id)).size).toBe(3);
    expect(synth[0].issues).toContainEqual({ type: 'duplicate-name', count: 2 });
    expect(synth[1].issues).toContainEqual({ type: 'duplicate-name', count: 2 });
    // Le quantità restano indipendenti (nessun merge): 1 e 2 pezzi del prodotto 1.
    expect(synth[0].buyer.order).toEqual({ 1: 1 });
    expect(synth[1].buyer.order).toEqual({ 1: 2 });
  });

  it('non segnala i nomi unici', () => {
    expect(synth[2].buyer.name).toBe('Lucia Bianchi');
    expect(synth[2].issues.some((i) => i.type === 'duplicate-name')).toBe(false);
  });
});

describe('reconcile — ordinato per prodotto', () => {
  it('somma l\'ordinato di tutti i clienti per prodotto (733 pezzi in totale)', () => {
    const rows = reconcile(drafts, catalog);
    expect(rows.length).toBe(12);
    const totalOrdered = rows.reduce((s, r) => s + r.ordered, 0);
    expect(totalOrdered).toBe(733);
  });

  it('il valore totale dell\'ordinato coincide con la somma dei totali di riga', () => {
    const grand = drafts.reduce((s, d) => s + d.total, 0);
    expect(grand).toBe(21374);
  });
});
