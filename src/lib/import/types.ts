import type { Buyer } from '../types';

/** Tabella grezza estratta dal file (CSV o Excel), normalizzata a stringhe. */
export interface ParsedTable {
  columns: string[]; // intestazioni (possono essere vuote)
  rows: string[][]; // celle allineate alle colonne per indice
  fileName: string;
}

/** Ruolo assegnato a una colonna del file. */
export type ColumnRole =
  | { kind: 'ignore' }
  | { kind: 'name' }
  | { kind: 'phone' }
  | { kind: 'product'; number: number }; // agganciata a un prodotto di catalogo

/** Mappatura: un ruolo per ogni colonna, indicizzato come `columns`. */
export type Mapping = ColumnRole[];

/** Problema rilevato su una riga in anteprima. */
export type RowIssue =
  | { type: 'name-missing' }
  | { type: 'bad-quantity'; column: string; value: string };

/** Riga interpretata (bozza di buyer) con totale e problemi. */
export interface DraftRow {
  id: string; // id del buyer generato + key React
  buyer: Buyer;
  total: number; // ricalcolato dai prezzi di CATALOGO
  pieces: number; // pezzi totali nell'ordine
  issues: RowIssue[];
  valid: boolean; // false se manca il nome (non importabile)
}

/** Confronto ordinato vs giacenza iniziale per un prodotto. */
export interface ReconcileRow {
  number: number;
  nameSv: string;
  ordered: number;
  initialStock: number;
  delta: number; // initialStock − ordered; < 0 = ammanco (scoperto)
}
