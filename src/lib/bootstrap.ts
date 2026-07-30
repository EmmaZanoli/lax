import { get as idbGet } from 'idb-keyval';
import { STORAGE_KEY, useStore } from './store';
import { seedBuyers, seedCatalog } from './seed';

/**
 * Avvio dell'app: reidrata lo stato da IndexedDB PRIMA del primo render
 * (niente flash di stato vuoto) e, solo in sviluppo e solo al primissimo
 * avvio (nessun dato mai salvato), carica i dati di esempio.
 */
export async function bootstrap(): Promise<void> {
  let firstRun = false;
  try {
    // Se non esiste alcuna chiave persistita, è il primo avvio in assoluto.
    firstRun = (await idbGet(STORAGE_KEY)) == null;
    await useStore.persist.rehydrate();
  } catch (err) {
    // Non blocchiamo l'avvio se IndexedDB non è disponibile.
    console.error('Reidratazione fallita:', err);
  }

  useStore.getState()._setHydrated(true);

  if (import.meta.env.DEV && firstRun) {
    useStore.getState()._replaceAll({
      catalog: seedCatalog,
      buyers: seedBuyers,
      importedAt: new Date().toISOString(),
    });
  }
}
