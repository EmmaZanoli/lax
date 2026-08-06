import { describe, it, expect } from 'vitest';
import { needsBackup } from './persistence';

describe('needsBackup — quando c è lavoro da mettere al sicuro', () => {
  it('senza dati non c è nulla da salvare', () => {
    expect(needsBackup(false, {})).toBe(false);
    expect(needsBackup(false, { lastMutatedAt: '2026-01-01T10:00:00Z' })).toBe(false);
  });
  it("con dati e nessun backup mai fatto: da salvare", () => {
    expect(needsBackup(true, {})).toBe(true);
    expect(needsBackup(true, { lastMutatedAt: '2026-01-01T10:00:00Z' })).toBe(true);
  });
  it('con un backup e nessuna modifica tracciata: al sicuro', () => {
    expect(needsBackup(true, { lastBackupAt: '2026-01-01T10:00:00Z' })).toBe(false);
  });
  it("modifiche DOPO l'ultimo backup: da salvare", () => {
    expect(
      needsBackup(true, {
        lastBackupAt: '2026-01-01T10:00:00Z',
        lastMutatedAt: '2026-01-01T10:05:00Z',
      }),
    ).toBe(true);
  });
  it("backup DOPO l'ultima modifica: al sicuro", () => {
    expect(
      needsBackup(true, {
        lastBackupAt: '2026-01-01T10:05:00Z',
        lastMutatedAt: '2026-01-01T10:00:00Z',
      }),
    ).toBe(false);
  });
  it('stesso istante (dopo un ripristino): al sicuro — confronto stretto >', () => {
    const t = '2026-01-01T10:00:00Z';
    expect(needsBackup(true, { lastBackupAt: t, lastMutatedAt: t })).toBe(false);
  });
});
