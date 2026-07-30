import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { ColumnRole } from './types';

const KEY = 'lax-import-mappings';

/** signature del formato -> (nome colonna -> ruolo). */
type SavedMappings = Record<string, Record<string, ColumnRole>>;

/** Carica la mappatura salvata per un formato (per firma delle intestazioni). */
export async function loadSavedMapping(
  sig: string,
): Promise<Record<string, ColumnRole> | null> {
  try {
    const all = (await idbGet<SavedMappings>(KEY)) ?? {};
    return all[sig] ?? null;
  } catch {
    return null;
  }
}

/** Salva la mappatura scelta, così un reimport dello stesso formato è immediato. */
export async function saveMapping(
  sig: string,
  columns: string[],
  mapping: ColumnRole[],
): Promise<void> {
  try {
    const all = (await idbGet<SavedMappings>(KEY)) ?? {};
    const byName: Record<string, ColumnRole> = {};
    columns.forEach((col, i) => {
      byName[col] = mapping[i] ?? { kind: 'ignore' };
    });
    all[sig] = byName;
    await idbSet(KEY, all);
  } catch {
    // Il salvataggio della mappatura è un comfort, non deve bloccare l'import.
  }
}
