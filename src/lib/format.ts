const euroNumber = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Importo in euro con simbolo davanti: `€ 1.234,56`. */
export function formatEuro(value: number): string {
  return `€ ${euroNumber.format(value)}`;
}

const dateTime = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Data/ora leggibile da un timestamp ISO. */
export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateTime.format(d);
}
