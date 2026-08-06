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

/** Cognome per l'ordinamento: ultima parola del nome completo. */
export function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

/**
 * Tempo trascorso da un istante ISO, in forma breve italiana ("poco fa",
 * "3 min fa", "2 h fa", "1 g fa"). `now` è iniettabile per i test.
 */
export function timeAgo(iso?: string, now: number = Date.now()): string {
  if (!iso) return 'mai';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'mai';
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 45) return 'poco fa';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min fa`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.round(hours / 24);
  return `${days} g fa`;
}
