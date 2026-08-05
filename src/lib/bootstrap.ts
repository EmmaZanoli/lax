import { useStore } from './store';
import { fetchCatalog } from './catalog';
import { resolveBootstrap } from './bootstrapPlan';

/**
 * Avvio dell'app: reidrata lo stato da IndexedDB PRIMA del primo render
 * (niente flash di stato vuoto), poi decide (in modo puro, vedi
 * `resolveBootstrap`) se caricare il catalogo di default o lasciare intatto
 * lo stato persistito.
 *
 * Il catalogo PERSISTITO è la fonte autorevole: contiene la giacenza iniziale
 * inserita dall'utente e non va mai sovrascritto da /catalog.json a ogni avvio
 * (altrimenti la giacenza tornerebbe a 0). Lo stato deve sopravvivere a
 * chiusura/refresh; la sostituzione del catalogo è deliberata (schermata Prodotti).
 */
export async function bootstrap(): Promise<void> {
  try {
    await useStore.persist.rehydrate();
  } catch (err) {
    console.error('Reidratazione fallita:', err);
  }

  useStore.getState()._setHydrated(true);

  const s = useStore.getState();
  const fetched = await fetchCatalog();

  const plan = resolveBootstrap({
    persisted: { catalog: s.catalog, buyers: s.buyers, importedAt: s.importedAt },
    fetched,
  });

  if (plan.action === 'replace') {
    useStore.getState()._replaceAll({
      catalog: plan.catalog,
      buyers: plan.buyers,
      importedAt: plan.importedAt,
    });
  }
}
