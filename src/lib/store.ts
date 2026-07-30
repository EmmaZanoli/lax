import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { AppState, Buyer, PaymentStatus, Product } from './types';

export const STORAGE_KEY = 'lax-state';

/**
 * Storage personalizzato su IndexedDB (via idb-keyval).
 * NIENTE localStorage: la persistenza deve sopravvivere a chiusure e refresh.
 */
const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: async (name, value) => {
    await idbSet(name, value);
  },
  removeItem: async (name) => {
    await idbDel(name);
  },
};

/** Fotografia dei soli dati, per l'undo a un livello. */
type Snapshot = AppState;

interface StoreState extends AppState {
  /** true quando la reidratazione da IndexedDB è terminata. */
  hydrated: boolean;
  /** Snapshot precedente l'ultima mutazione (undo a un livello). */
  _snapshot: Snapshot | null;
  /** true se c'è un'azione annullabile. */
  canUndo: boolean;

  // --- azioni ---
  setPayment: (id: string, mode: PaymentStatus) => void;
  setPickup: (id: string, value: boolean) => void;
  undo: () => void;
  importData: (buyers: Buyer[], catalog?: Product[]) => void;
  setInitialStock: (number: number, value: number) => void;
  updateProduct: (number: number, patch: Partial<Product>) => void;
  loadCatalog: (catalog: Product[]) => void;
  resetDay: () => void;
  clearAll: () => void;

  /** Reimposta lo stato dati senza toccare l'undo (uso interno: seed di sviluppo). */
  _replaceAll: (data: Partial<AppState>) => void;
  _setHydrated: (v: boolean) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      /** Cattura lo stato-dati corrente come snapshot per l'undo. */
      const snapshot = (): Snapshot => {
        const { catalog, buyers, importedAt } = get();
        return { catalog, buyers, importedAt };
      };

      /** Applica una modifica ai dati salvando prima lo snapshot per l'undo. */
      const commit = (patch: Partial<AppState>) => {
        set({ _snapshot: snapshot(), canUndo: true, ...patch });
      };

      return {
        catalog: [],
        buyers: [],
        importedAt: undefined,
        hydrated: false,
        _snapshot: null,
        canUndo: false,

        // Sceglie il pagamento e garantisce l'invariante payment ≠ none ⇒ pickedUp.
        setPayment: (id, mode) => {
          const buyers = get().buyers.map((b) =>
            b.id === id ? { ...b, payment: mode, pickedUp: true } : b,
          );
          commit({ buyers });
        },

        // Annullare il ritiro azzera anche il pagamento (mantiene l'invariante).
        setPickup: (id, value) => {
          const buyers = get().buyers.map((b) =>
            b.id === id
              ? { ...b, pickedUp: value, payment: value ? b.payment : 'none' }
              : b,
          );
          commit({ buyers });
        },

        undo: () => {
          const snap = get()._snapshot;
          if (!snap) return;
          set({
            catalog: snap.catalog,
            buyers: snap.buyers,
            importedAt: snap.importedAt,
            _snapshot: null,
            canUndo: false,
          });
        },

        // Sostituisce i buyer; opzionalmente aggiorna il catalogo.
        importData: (buyers, catalog) => {
          commit({
            buyers,
            ...(catalog ? { catalog } : {}),
            importedAt: new Date().toISOString(),
          });
        },

        setInitialStock: (number, value) => {
          const catalog = get().catalog.map((p) =>
            p.number === number ? { ...p, initialStock: value } : p,
          );
          commit({ catalog });
        },

        // Modifica anagrafica/giacenza di un prodotto; si riflette subito nei selettori.
        updateProduct: (number, patch) => {
          const catalog = get().catalog.map((p) =>
            p.number === number ? { ...p, ...patch, number: p.number } : p,
          );
          commit({ catalog });
        },

        loadCatalog: (catalog) => {
          commit({ catalog });
        },

        // Nuovo anno: rimuove tutti i buyer (e la data di import), conserva il catalogo.
        resetDay: () => {
          commit({ buyers: [], importedAt: undefined });
        },

        clearAll: () => {
          commit({ catalog: [], buyers: [], importedAt: undefined });
        },

        _replaceAll: (data) => {
          set({
            ...data,
            _snapshot: null,
            canUndo: false,
          });
        },

        _setHydrated: (v) => set({ hydrated: v }),
      };
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      // Persistiamo solo i dati, non l'undo né i flag di runtime.
      partialize: (s) => ({
        catalog: s.catalog,
        buyers: s.buyers,
        importedAt: s.importedAt,
      }),
      // La reidratazione è pilotata manualmente all'avvio (vedi bootstrap in main.tsx).
      skipHydration: true,
    },
  ),
);
