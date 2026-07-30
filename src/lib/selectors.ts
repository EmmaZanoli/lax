import type { AppState, Buyer, Product } from './types';

/**
 * Selettori derivati PURI. Non importano lo store: prendono in ingresso lo
 * stato (o le sue parti) e restituiscono valori calcolati. Così sono
 * facilmente testabili e riusabili in qualsiasi schermata.
 */

/** Mappa numeroProdotto -> prezzo di catalogo. */
function priceByNumber(catalog: Product[]): Map<number, number> {
  return new Map(catalog.map((p) => [p.number, p.price]));
}

/**
 * Totale di un ordine = Σ (quantità × prezzo di CATALOGO).
 * I prezzi vengono sempre dal catalogo, mai dall'ordine/CSV.
 */
export function orderTotal(buyer: Buyer, catalog: Product[]): number {
  const prices = priceByNumber(catalog);
  let sum = 0;
  for (const [number, qty] of Object.entries(buyer.order)) {
    const price = prices.get(Number(number)) ?? 0;
    sum += qty * price;
  }
  return sum;
}

/** Numero totale di pezzi in un ordine. */
export function orderPieces(buyer: Buyer): number {
  let n = 0;
  for (const qty of Object.values(buyer.order)) n += qty;
  return n;
}

export interface Totals {
  /** Valore € dei ritirati pagati in contanti. */
  cash: number;
  /** Valore € dei ritirati con bonifico ricevuto. */
  received: number;
  /** Valore € dei ritirati con bonifico atteso. */
  pending: number;
  /** Valore € dei ritirati non ancora pagati (payment = 'none'). */
  unpaid: number;
  /** Valore € degli ordini di chi NON ha ritirato. */
  toPickValue: number;
  /** Quanti buyer non hanno ancora ritirato. */
  toPickCount: number;
}

/**
 * Aggregati di denaro. Le prime quattro voci ripartiscono per stato di
 * pagamento il valore dei soli buyer RITIRATI; `toPick*` riguarda chi non
 * ha ritirato.
 *
 * Quadratura: cash + received + pending + unpaid = valore ordini ritirati.
 */
export function totals(state: AppState): Totals {
  const { buyers, catalog } = state;
  const prices = priceByNumber(catalog);

  const valueOf = (b: Buyer) => {
    let sum = 0;
    for (const [number, qty] of Object.entries(b.order)) {
      sum += qty * (prices.get(Number(number)) ?? 0);
    }
    return sum;
  };

  const t: Totals = {
    cash: 0,
    received: 0,
    pending: 0,
    unpaid: 0,
    toPickValue: 0,
    toPickCount: 0,
  };

  for (const b of buyers) {
    const value = valueOf(b);
    if (!b.pickedUp) {
      t.toPickValue += value;
      t.toPickCount += 1;
      continue;
    }
    switch (b.payment) {
      case 'cash':
        t.cash += value;
        break;
      case 'received':
        t.received += value;
        break;
      case 'pending':
        t.pending += value;
        break;
      case 'none':
        t.unpaid += value;
        break;
    }
  }

  return t;
}

/** Valore complessivo degli ordini ritirati (deve quadrare con cash+received+pending+unpaid). */
export function pickedUpValue(t: Totals): number {
  return t.cash + t.received + t.pending + t.unpaid;
}

export interface StockStatus {
  number: number;
  /** Pezzi ordinati in totale (tutti i buyer). */
  ordered: number;
  /** Pezzi negli ordini con pickedUp = true. */
  pickedUp: number;
  /** Giacenza residua = initialStock − pickedUp. */
  residual: number;
  /** initialStock − ordered. Se < 0 il prodotto è SCOPERTO (ammanco). */
  delta: number;
}

/**
 * Stato di magazzino per ogni prodotto del catalogo.
 * È il RITIRO a scalare la giacenza, non il pagamento.
 */
export function stockStatus(state: AppState): StockStatus[] {
  const { catalog, buyers } = state;
  return catalog.map((p) => {
    let ordered = 0;
    let pickedUp = 0;
    for (const b of buyers) {
      const qty = b.order[p.number] ?? 0;
      if (qty <= 0) continue;
      ordered += qty;
      if (b.pickedUp) pickedUp += qty;
    }
    return {
      number: p.number,
      ordered,
      pickedUp,
      residual: p.initialStock - pickedUp,
      delta: p.initialStock - ordered,
    };
  });
}
