import type { AppState } from './types';
import {
  orderTotal,
  totals,
  pickedUpValue,
  isCustomer,
} from './selectors';

/**
 * true se il valore degli ordini CLIENTE ritirati quadra con le quattro voci
 * di denaro. Gli ordini per uso personale sono esclusi dalla quadratura clienti.
 */
export function isBalanced(state: AppState): boolean {
  const t = totals(state);
  const pickedOrders = state.buyers
    .filter((b) => isCustomer(b) && b.pickedUp)
    .reduce((s, b) => s + orderTotal(b, state.catalog), 0);
  return Math.abs(pickedOrders - pickedUpValue(t)) < 0.005;
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

export function downloadBackup(state: AppState): void {
  downloadText(`lax-backup-${today()}.json`, backupJson(state), 'application/json');
}
