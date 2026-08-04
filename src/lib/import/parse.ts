import type { ParsedTable } from './types';

// NB: `papaparse` e soprattutto `xlsx` (SheetJS) sono librerie pesanti ma servono
// SOLO durante l'import. Vengono caricate con import() dinamico, così finiscono
// in chunk a parte (precache-ati dal service worker, quindi disponibili offline)
// e non appesantiscono il bundle principale caricato da ogni schermata.

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
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') return parseExcel(file);
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
 * Legge un workbook Excel già in memoria (primo foglio) e lo normalizza a
 * colonne + righe di stringhe. Estratta da `parseExcel` per essere testabile
 * senza l'API `File` (i test la chiamano con il buffer del foglio reale).
 * `raw: false` forza i valori come testo formattato: così "00" resta "00" e le
 * celle vuote/saltate diventano '' (poi lette come 0 a valle).
 * È async perché `xlsx` viene importato dinamicamente (vedi nota in testa).
 */
export async function tableFromWorkbookBuffer(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
): Promise<ParsedTable> {
  const XLSX = await import('xlsx');
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  const sheet = firstSheet ? workbook.Sheets[firstSheet] : undefined;
  if (!sheet) throw new Error('Il foglio Excel è vuoto.');
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false, // valori formattati come testo
    defval: '',
    blankrows: false,
  });
  return toTable(matrix as unknown as string[][], fileName);
}

async function parseExcel(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  return tableFromWorkbookBuffer(buffer, file.name);
}
