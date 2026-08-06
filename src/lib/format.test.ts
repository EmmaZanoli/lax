import { describe, it, expect } from 'vitest';
import { timeAgo } from './format';

describe('timeAgo — tempo relativo breve in italiano', () => {
  const t0 = new Date('2026-01-01T12:00:00Z').getTime();
  const secAgo = (sec: number) => new Date(t0 - sec * 1000).toISOString();

  it('senza istante o con data invalida ritorna "mai"', () => {
    expect(timeAgo(undefined, t0)).toBe('mai');
    expect(timeAgo('non-una-data', t0)).toBe('mai');
  });
  it('sotto i 45 secondi: "poco fa"', () => {
    expect(timeAgo(secAgo(10), t0)).toBe('poco fa');
  });
  it('minuti', () => {
    expect(timeAgo(secAgo(300), t0)).toBe('5 min fa');
  });
  it('ore', () => {
    expect(timeAgo(secAgo(2 * 3600), t0)).toBe('2 h fa');
  });
  it('giorni', () => {
    expect(timeAgo(secAgo(3 * 86400), t0)).toBe('3 g fa');
  });
});
