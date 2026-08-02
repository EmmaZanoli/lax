/** Stato di pagamento di un buyer. */
export type PaymentStatus = 'none' | 'cash' | 'pending' | 'received';

/** Prodotto del catalogo. Il `number` è la chiave stabile per l'aggancio col CSV. */
export interface Product {
  number: number;
  nameSv: string;      // nome svedese (mostrato)
  weight: string;      // formato/peso (es. "1/1", "1/2", "300g") — necessario per distinguere prodotti omonimi
  category?: string;   // raggruppamento (es. "Salmone", "Anguilla", "Aringhe")
  descIt: string;      // descrizione italiana
  photoUrl?: string;
  price: number;       // unica fonte di verità per i prezzi
  initialStock: number; // giacenza iniziale (compilata quando arriva la merce)
}

/** Buyer con il suo ordine immutabile e i due stati indipendenti ritiro/pagamento. */
export interface Buyer {
  id: string;
  name: string;
  phone?: string;
  order: Record<number, number>; // numeroProdotto -> quantità
  pickedUp: boolean;
  payment: PaymentStatus;
}

/** Stato applicativo persistito. */
export interface AppState {
  catalog: Product[];
  buyers: Buyer[];
  importedAt?: string; // ISO timestamp dell'ultimo import
}
