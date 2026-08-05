import type { AppState, Buyer, Product } from './types';

/**
 * Decisione PURA su cosa fare dei dati all'avvio, estratta da `bootstrap` per
 * essere testabile senza IndexedDB né fetch. Nessun effetto collaterale: prende
 * lo stato persistito + il catalogo letto da /catalog.json e restituisce un
 * piano che l'orchestratore applica.
 *
 * Invariante chiave (regressione): il catalogo PERSISTITO è autorevole e non va
 * mai sovrascritto da /catalog.json a un normale reload, altrimenti la giacenza
 * iniziale inserita dall'utente tornerebbe ai valori del file (0). Lo stato deve
 * sopravvivere a chiusura/refresh.
 */
export type BootstrapPlan =
  | { action: 'keep' }
  | { action: 'replace'; catalog: Product[]; buyers: Buyer[]; importedAt?: string };

export interface BootstrapInput {
  persisted: Pick<AppState, 'catalog' | 'buyers' | 'importedAt'>;
  fetched: Product[];
}

export function resolveBootstrap(input: BootstrapInput): BootstrapPlan {
  const { persisted, fetched } = input;

  // Catalogo già persistito ⇒ autorevole: lascialo com'è (giacenze comprese).
  // La sostituzione del catalogo è un'azione deliberata (schermata Prodotti).
  if (persisted.catalog.length > 0) return { action: 'keep' };

  // Primo avvio senza catalogo persistito: carica il default da /catalog.json,
  // conservando gli eventuali buyer già presenti.
  if (fetched.length > 0) {
    return {
      action: 'replace',
      catalog: fetched,
      buyers: persisted.buyers,
      importedAt: persisted.importedAt,
    };
  }

  return { action: 'keep' };
}
