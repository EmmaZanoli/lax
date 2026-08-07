import { useEffect, useRef } from 'react';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { AppState, Buyer, Product } from './types';
import { useStore } from './store';

/**
 * Backup automatico SILENZIOSO durante la giornata: a intervalli regolari, se i
 * dati sono cambiati, salva uno snapshot in IndexedDB tenendo solo gli ultimi N
 * (ring buffer). È una rete di sicurezza IN-APP contro errori operativi (un
 * «Nuovo anno» sbagliato, un ripristino errato, azioni di troppo oltre l'undo a
 * un livello): dalla schermata Backup si può tornare a un punto recente.
 *
 * NB: vive nello stesso IndexedDB dello stato, quindi NON protegge dallo sfratto
 * dello storage o dalla perdita del dispositivo — per quello servono i backup su
 * file (export). Sono due livelli complementari.
 */

const SNAPSHOT_KEY = 'lax-autosnapshots';
/** Quanti snapshot conservare (ring buffer). */
const MAX_SNAPSHOTS = 20;
/** Ogni quanto valutare uno snapshot (ms). Salva solo se qualcosa è cambiato. */
const INTERVAL_MS = 3 * 60 * 1000;

/** Uno snapshot automatico: solo i dati, con il momento in cui è stato preso. */
export interface AutoSnapshot {
  savedAt: string;
  catalog: Product[];
  buyers: Buyer[];
}

/** Carica gli snapshot automatici (dal più vecchio al più recente). `[]` se assenti. */
export async function loadAutoSnapshots(): Promise<AutoSnapshot[]> {
  const v = await idbGet<AutoSnapshot[]>(SNAPSHOT_KEY);
  return Array.isArray(v) ? v : [];
}

/**
 * Aggiunge uno snapshot dei dati correnti e mantiene solo gli ultimi
 * `MAX_SNAPSHOTS`. Ritorna la lista aggiornata (utile per i test). `now`
 * iniettabile per determinismo.
 */
export async function saveAutoSnapshot(
  state: Pick<AppState, 'catalog' | 'buyers'>,
  now: Date = new Date(),
): Promise<AutoSnapshot[]> {
  const snaps = await loadAutoSnapshots();
  const next = [
    ...snaps,
    { savedAt: now.toISOString(), catalog: state.catalog, buyers: state.buyers },
  ].slice(-MAX_SNAPSHOTS);
  await idbSet(SNAPSHOT_KEY, next);
  return next;
}

/** Cancella tutti gli snapshot automatici (es. all'azzeramento «Nuovo anno»). */
export async function clearAutoSnapshots(): Promise<void> {
  await idbDel(SNAPSHOT_KEY);
}

/**
 * Monta il salvataggio periodico degli snapshot. A ogni tick, se ci sono buyer e
 * i dati sono cambiati dall'ultimo snapshot (confronto su `lastMutatedAt`), ne
 * salva uno. Va montato una volta sola (in App).
 */
export function useAutoBackup(): void {
  const lastSnapshottedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const tick = () => {
      const s = useStore.getState();
      if (s.buyers.length === 0) return;
      if (!s.lastMutatedAt || s.lastMutatedAt === lastSnapshottedRef.current) return;
      lastSnapshottedRef.current = s.lastMutatedAt;
      void saveAutoSnapshot({ catalog: s.catalog, buyers: s.buyers });
    };
    const id = window.setInterval(tick, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);
}
