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

/** Backup completo dello stato in JSON (formato v1: top-level catalog + buyers). */
export function backupJson(state: AppState): string {
  return JSON.stringify(
    {
      app: 'lax',
      type: 'backup',
      version: 1,
      savedAt: new Date().toISOString(),
      catalog: state.catalog,
      buyers: state.buyers,
    },
    null,
    2,
  );
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
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
  downloadText(`backup-lax-${nowStamp()}.json`, backupJson(state), 'application/json');
}
