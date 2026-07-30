import type { AppState, Buyer } from './types';
import { orderTotal, totals, pickedUpValue, stockStatus } from './selectors';

/** Numero con virgola decimale e 2 cifre (per Excel italiano). */
function num2(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/** Cella CSV messa in sicurezza (quote se contiene separatore/virgolette/newline). */
function csvCell(value: string | number): string {
  const s = String(value);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cells: (string | number)[]): string {
  return cells.map(csvCell).join(';');
}

function pickupLabel(b: Buyer): string {
  return b.pickedUp ? 'Ritirato' : 'Da ritirare';
}

function paymentLabel(b: Buyer): string {
  if (!b.pickedUp) return '—';
  switch (b.payment) {
    case 'cash':
      return 'Contanti';
    case 'pending':
      return 'Bonifico atteso';
    case 'received':
      return 'Bonifico ricevuto';
    default:
      return 'Non pagato';
  }
}

/** true se il valore degli ordini ritirati quadra con le quattro voci di denaro. */
export function isBalanced(state: AppState): boolean {
  const t = totals(state);
  const pickedOrders = state.buyers
    .filter((b) => b.pickedUp)
    .reduce((s, b) => s + orderTotal(b, state.catalog), 0);
  return Math.abs(pickedOrders - pickedUpValue(t)) < 0.005;
}

/** CSV di fine giornata: 5 voci denaro + lista ordini + magazzino. */
export function recapCsv(state: AppState): string {
  const t = totals(state);
  const lines: string[] = [];

  lines.push(row(['Recap lax']));
  lines.push(row(['Esportato il', new Date().toLocaleString('it-IT')]));
  lines.push('');

  lines.push(row(['Denaro', 'Valore (€)', 'Ordini']));
  lines.push(row(['Contanti in cassa', num2(t.cash), '']));
  lines.push(row(['Bonifici ricevuti', num2(t.received), '']));
  lines.push(row(['Bonifici attesi', num2(t.pending), '']));
  lines.push(row(['Ritirato non pagato', num2(t.unpaid), '']));
  lines.push(row(['Devono ritirare', num2(t.toPickValue), t.toPickCount]));
  lines.push(row(['Quadratura', isBalanced(state) ? 'OK' : 'DA VERIFICARE', '']));
  lines.push('');

  lines.push(row(['Ordini']));
  lines.push(row(['Nome', 'Telefono', 'Pezzi', 'Ritiro', 'Pagamento', 'Totale (€)']));
  for (const b of state.buyers) {
    const pieces = Object.values(b.order).reduce((s, q) => s + q, 0);
    lines.push(
      row([
        b.name,
        b.phone ?? '',
        pieces,
        pickupLabel(b),
        paymentLabel(b),
        num2(orderTotal(b, state.catalog)),
      ]),
    );
  }
  lines.push('');

  lines.push(row(['Magazzino']));
  lines.push(row(['Numero', 'Prodotto', 'Ordinati', 'Ritirati', 'Residuo']));
  const stock = stockStatus(state);
  const nameByNumber = new Map(state.catalog.map((p) => [p.number, p.nameSv]));
  for (const s of stock) {
    lines.push(
      row([s.number, nameByNumber.get(s.number) ?? '', s.ordered, s.pickedUp, s.residual]),
    );
  }

  return lines.join('\r\n');
}

/** Backup completo dello stato in JSON. */
export function backupJson(state: AppState): string {
  return JSON.stringify(
    {
      app: 'lax',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: {
        catalog: state.catalog,
        buyers: state.buyers,
        importedAt: state.importedAt,
      },
    },
    null,
    2,
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Scarica un testo come file (download nel browser). */
function downloadText(filename: string, text: string, mime: string, bom = false): void {
  const parts = bom ? ['﻿', text] : [text];
  const blob = new Blob(parts, { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadRecap(state: AppState): void {
  // BOM: fa leggere correttamente gli accenti svedesi a Excel.
  downloadText(`lax-recap-${today()}.csv`, recapCsv(state), 'text/csv', true);
}

export function downloadBackup(state: AppState): void {
  downloadText(`lax-backup-${today()}.json`, backupJson(state), 'application/json');
}
