import type { ParsedTable } from './types';

// NB: `papaparse` (CSV) è importato dinamicamente, così finisce in un chunk a
// parte (precache-ato dal service worker → offline) e non appesantisce il bundle
// principale. Gli `.xlsx` li legge ExcelJS, GIÀ nel bundle per l'export del
// recap: nessuna seconda libreria Excel (niente SheetJS/xlsx, che tra l'altro
// non è più pubblicato su npm con i fix di sicurezza).

/** Normalizza una cella a stringa pulita (togliendo BOM e spazi). */
function cell(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/^﻿/, '').trim();
}

function cleanRow(cells: unknown[]): string[] {
  return cells.map(cell);
}

/** true se la riga contiene almeno una cella non vuota. */
function nonEmpty(row: string[]): boolean {
  return row.some((c) => c !== '');
}

/** Estensione del file in minuscolo. */
function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** Legge un file .csv/.xlsx e restituisce colonne + righe come stringhe. */
export async function parseFile(file: File): Promise<ParsedTable> {
  const ext = extensionOf(file.name);
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return parseCsv(file);
  if (ext === 'xlsx' || ext === 'xlsm') return parseExcel(file);
  throw new Error(`Formato non supportato (.${ext}). Usa .csv o .xlsx.`);
}

function toTable(matrix: string[][], fileName: string): ParsedTable {
  const cleaned = matrix.map(cleanRow);
  if (cleaned.length === 0) throw new Error('Il file non contiene dati.');
  const columns = cleaned[0];
  const rows = cleaned.slice(1).filter(nonEmpty);
  return { columns, rows, fileName };
}

async function parseCsv(file: File): Promise<ParsedTable> {
  const { default: Papa } = await import('papaparse');
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: (result) => {
        try {
          resolve(toTable(result.data as unknown as string[][], file.name));
        } catch (err) {
          reject(err);
        }
      },
      error: (err: unknown) =>
        reject(err instanceof Error ? err : new Error('Errore di lettura del CSV.')),
    });
  });
}

/**
 * Converte il valore di una cella ExcelJS nel suo testo. ExcelJS restituisce
 * tipi ricchi (numeri, date, rich text, formule, hyperlink); li normalizziamo a
 * stringa come faceva SheetJS con `raw:false`, così l'aggancio prodotti (intero
 * iniziale dell'etichetta) e le quantità (testo libero del form) restano identici.
 */
function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    // Rich text: concatena i frammenti (le etichette-prodotto possono esserlo).
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((r) => r.text ?? '').join('');
    }
    if ('result' in o) return cellText(o.result); // formula col risultato precalcolato
    if ('text' in o) return String(o.text ?? ''); // hyperlink
    if ('formula' in o || 'error' in o) return ''; // formula senza risultato / errore
  }
  return String(value);
}

/**
 * Legge un workbook Excel già in memoria (primo foglio) e lo normalizza a
 * colonne + righe di stringhe. Estratta da `parseExcel` per essere testabile
 * senza l'API `File` (i test la chiamano con il buffer del foglio reale).
 * È async perché ExcelJS viene importato dinamicamente (vedi nota in testa).
 */
export async function tableFromWorkbookBuffer(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
): Promise<ParsedTable> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Il foglio Excel è vuoto.');

  // getSheetValues: righe 1-indexed (a loro volta 1-indexed); le righe vuote sono
  // buchi ⇒ saltate (equivale a blankrows:false). Riportiamo a 0-index e
  // impaginiamo a larghezza costante, riempiendo le celle mancanti con '' (come
  // faceva `defval:''`), così le celle saltate dalle diramazioni del form → 0.
  const sheetValues = ws.getSheetValues() as unknown[][];
  const rawRows: unknown[][] = [];
  for (const row of sheetValues) {
    if (!row) continue;
    rawRows.push(row.slice(1));
  }
  const width = rawRows.reduce((m, r) => Math.max(m, r.length), 0);
  const matrix = rawRows.map((r) => {
    const out: string[] = [];
    for (let i = 0; i < width; i++) out.push(cellText(r[i]));
    return out;
  });

  return toTable(matrix, fileName);
}

async function parseExcel(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  return tableFromWorkbookBuffer(buffer, file.name);
}
