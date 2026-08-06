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
  | { kind: 'email' }
  | { kind: 'product'; number: number }; // agganciata a un prodotto di catalogo per NUMERO

/** Mappatura: un ruolo per ogni colonna, indicizzato come `columns`. */
export type Mapping = ColumnRole[];

/**
 * Problema rilevato su una riga in anteprima. `name-missing` ed `empty-order`
 * rendono la riga non importabile (`valid=false`); gli altri sono avvisi.
 * - `name-missing`: riga senza nome — non importabile;
 * - `empty-order`: nome presente ma nessun prodotto ordinato — non importabile;
 * - `bad-quantity`: cella prodotto con testo non convertibile a numero — la cella viene ignorata;
 * - `adjusted-quantity`: quantità non intera o negativa — arrotondata/azzerata (`applied`), segnalata;
 * - `duplicate-name`: nome su più righe (possibile doppio invio) — da rivedere, mai unito in automatico.
 */
export type RowIssue =
  | { type: 'name-missing' }
  | { type: 'empty-order' }
  | { type: 'bad-quantity'; column: string; value: string }
  | { type: 'adjusted-quantity'; column: string; value: string; applied: number }
  | { type: 'duplicate-name'; count: number };

/** Riga interpretata (bozza di buyer) con totale e problemi. */
export interface DraftRow {
  id: string; // id del buyer generato + key React
  buyer: Buyer;
  total: number; // ricalcolato dai prezzi di CATALOGO
  pieces: number; // pezzi totali nell'ordine
  issues: RowIssue[];
  valid: boolean; // false se manca il nome o l'ordine è vuoto (non importabile)
}

/** Confronto ordinato vs giacenza iniziale per un prodotto. */
export interface ReconcileRow {
  number: number;
  nameSv: string;
  ordered: number;
  initialStock: number;
  delta: number; // initialStock − ordered; < 0 = ammanco (scoperto)
}
