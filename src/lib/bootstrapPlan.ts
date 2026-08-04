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
 *
 * Il seed di sviluppo (ri)parte solo quando NON ci sono dati utente (nessun
 * buyer e nessun import): un cambio dei numeri prodotto in catalog.json non
 * cancella mai dati già importati.
 */
export type BootstrapPlan =
  | { action: 'keep' } // non toccare lo stato persistito
  | { action: 'replace'; catalog: Product[]; buyers: Buyer[]; importedAt?: string };

export interface BootstrapInput {
  /** true in sviluppo (import.meta.env.DEV): abilita il seed di esempio. */
  isDev: boolean;
  /** true se IndexedDB era vuoto: primissimo avvio. */
  firstRun: boolean;
  /** Stato reidratato da IndexedDB. */
  persisted: Pick<AppState, 'catalog' | 'buyers' | 'importedAt'>;
  /** Catalogo letto da /catalog.json (default sostituibile). */
  fetched: Product[];
  /** Buyer di esempio (solo dev). */
  seedBuyers: Buyer[];
  /** Giacenze di esempio per numero prodotto (solo dev). */
  seedStocks: Record<number, number>;
  /** Timestamp da usare come importedAt quando si (ri)carica il seed. */
  now: string;
}

export function resolveBootstrap(input: BootstrapInput): BootstrapPlan {
  const { isDev, firstRun, persisted, fetched, seedBuyers, seedStocks, now } = input;

  // In dev: (ri)carica il seed al primissimo avvio, oppure se i NUMERI di
  // prodotto in catalog.json non combaciano col persistito (evita ordini con
  // chiavi orfane dopo un cambio di catalogo in sviluppo).
  const oldNumbers = new Set(persisted.catalog.map((p) => p.number));
  const catalogChanged = fetched.length > 0 && fetched.some((p) => !oldNumbers.has(p.number));

  // ...ma il seed (ri)parte SOLO se non ci sono dati utente da perdere: nessun
  // buyer e nessun import registrato. Così, in dev, cambiare i numeri prodotto
  // in catalog.json non cancella più buyer importati / giacenze inserite.
  const hasUserData = persisted.buyers.length > 0 || persisted.importedAt != null;

  if (isDev && (firstRun || catalogChanged) && !hasUserData) {
    if (fetched.length === 0) return { action: 'keep' };
    const catalog = fetched.map((p) =>
      seedStocks[p.number] !== undefined ? { ...p, initialStock: seedStocks[p.number] } : p,
    );
    return { action: 'replace', catalog, buyers: seedBuyers, importedAt: now };
  }

  // Catalogo già persistito ⇒ autorevole: lascialo com'è (giacenze comprese).
  // La sostituzione del catalogo è un'azione deliberata (schermata Prodotti).
  if (persisted.catalog.length > 0) return { action: 'keep' };

  // Primo popolamento (nessun catalogo persistito): carica il default da file,
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
