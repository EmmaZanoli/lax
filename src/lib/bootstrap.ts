import { get as idbGet } from 'idb-keyval';
import { STORAGE_KEY, useStore } from './store';
import { fetchCatalog } from './catalog';
import { seedBuyers } from './seed';

/**
 * Avvio dell'app: reidrata lo stato da IndexedDB PRIMA del primo render
 * (niente flash di stato vuoto). Se non c'è catalogo, lo carica da
 * /catalog.json. Solo in sviluppo e solo al primissimo avvio carica anche i
 * buyer di esempio.
 */
export async function bootstrap(): Promise<void> {
  let firstRun = false;
  try {
    firstRun = (await idbGet(STORAGE_KEY)) == null;
    await useStore.persist.rehydrate();
  } catch (err) {
    console.error('Reidratazione fallita:', err);
  }

  useStore.getState()._setHydrated(true);

  const s = useStore.getState();
  if (s.catalog.length === 0) {
    const catalog = await fetchCatalog();
    if (import.meta.env.DEV && firstRun) {
      useStore.getState()._replaceAll({
        catalog,
        buyers: seedBuyers,
        importedAt: new Date().toISOString(),
      });
    } else if (catalog.length > 0) {
      useStore.getState()._replaceAll({
        catalog,
        buyers: s.buyers,
        importedAt: s.importedAt,
      });
    }
  }
}
