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
  const catalog = await fetchCatalog();
  if (catalog.length === 0) return;

  // In dev: se i numeri di prodotto sono cambiati rispetto allo stato persistito,
  // ricarica anche i buyer di esempio per evitare ordini con chiavi inesistenti.
  const oldNumbers = new Set(s.catalog.map((p) => p.number));
  const catalogChanged = catalog.some((p) => !oldNumbers.has(p.number));

  if (import.meta.env.DEV && (firstRun || catalogChanged)) {
    useStore.getState()._replaceAll({
      catalog,
      buyers: seedBuyers,
      importedAt: new Date().toISOString(),
    });
  } else {
    useStore.getState()._replaceAll({
      catalog,
      buyers: s.buyers,
      importedAt: s.importedAt,
    });
  }
}
