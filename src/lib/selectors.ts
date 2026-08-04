import type { AppState, Buyer, Product } from './types';

/**
 * Selettori derivati PURI. Non importano lo store: prendono in ingresso lo
 * stato (o le sue parti) e restituiscono valori calcolati. Così sono
 * facilmente testabili e riusabili in qualsiasi schermata.
 */

/**
 * true se l'ordine è per uso personale del seller.
 * Robusto verso dati vecchi senza `kind`: tutto ciò che non è 'personal' è cliente.
 */
export function isPersonal(b: Buyer): boolean {
  return b.kind === 'personal';
}

/** true se l'ordine è di un cliente da servire (default). */
export function isCustomer(b: Buyer): boolean {
  return b.kind !== 'personal';
}

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
  /** Valore € degli ordini dei CLIENTI che NON hanno ritirato. */
  toPickValue: number;
  /** Quanti CLIENTI non hanno ancora ritirato. */
  toPickCount: number;
  /** Valore € degli ordini per uso personale (fuori dai conti dei clienti). */
  personal: number;
  /** Quanti ordini per uso personale. */
  personalCount: number;
  /** Valore € di tutto l'ordinato: clienti (a ogni stato) + uso personale. */
  orderedTotal: number;
}

/**
 * Aggregati di denaro dei soli CLIENTI. Le prime quattro voci ripartiscono per
 * stato di pagamento il valore dei clienti RITIRATI; `toPick*` riguarda i
 * clienti che non hanno ritirato. Gli ordini `personal` sono esclusi da tutti
 * i bucket clienti e riepilogati a parte in `personal`/`personalCount`.
 *
 * Quadratura CLIENTI: cash + received + pending + unpaid = valore ordini clienti ritirati.
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
    personal: 0,
    personalCount: 0,
    orderedTotal: 0,
  };

  for (const b of buyers) {
    const value = valueOf(b);
    t.orderedTotal += value;

    // Uso personale: fuori da tutti i conteggi dei clienti.
    if (isPersonal(b)) {
      t.personal += value;
      t.personalCount += 1;
      continue;
    }

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

/** Valore complessivo degli ordini clienti ritirati (deve quadrare con cash+received+pending+unpaid). */
export function pickedUpValue(t: Totals): number {
  return t.cash + t.received + t.pending + t.unpaid;
}

/** Riga per prodotto dell'ordinato totale, incluso l'uso personale. */
export interface OrderedRow {
  number: number;
  /** Pezzi negli ordini clienti. */
  customer: number;
  /** Pezzi negli ordini per uso personale. */
  personal: number;
  /** Pezzi totali ordinati, incluso l'uso personale. */
  total: number;
  /** Valore € del totale = quantità totale × prezzo di catalogo. */
  value: number;
}

/** Aggregati dell'ordinato totale (clienti + personale) per la riconciliazione fattura. */
export interface OrderedTotals {
  /** Per prodotto (solo quelli con almeno un pezzo ordinato). */
  rows: OrderedRow[];
  /** Pezzi totali di tutti gli ordini (clienti + personale). */
  totalPieces: number;
  /** Pezzi dei soli ordini per uso personale. */
  personalPieces: number;
  /** Valore € di tutto l'ordinato (clienti + personale). */
  totalValue: number;
}

/**
 * Dato PURAMENTE INFORMATIVO per la riconciliazione con la fattura del fornitore.
 * Somma le quantità di TUTTI gli ordini (kind 'customer' + 'personal'), perché la
 * fattura include anche i pezzi personali.
 *
 * NON è un selettore di magazzino: non influenza in alcun modo giacenza,
 * `stockStatus`, residual, delta, "ancora da consegnare", "prodotti scoperti"
 * né i bucket di cassa. La giacenza resta solo-clienti (i pezzi personali sono
 * tolti dalle casse prima della consegna).
 */
export function orderedTotals(state: AppState): OrderedTotals {
  const { catalog, buyers } = state;
  const prices = priceByNumber(catalog);

  let totalPieces = 0;
  let personalPieces = 0;
  let totalValue = 0;
  const rows: OrderedRow[] = [];

  for (const p of catalog) {
    let customer = 0;
    let personal = 0;
    for (const b of buyers) {
      const qty = b.order[p.number] ?? 0;
      if (qty <= 0) continue;
      if (isPersonal(b)) personal += qty;
      else customer += qty;
    }
    const total = customer + personal;
    if (total === 0) continue;
    const value = total * (prices.get(p.number) ?? 0);
    totalPieces += total;
    personalPieces += personal;
    totalValue += value;
    rows.push({ number: p.number, customer, personal, total, value });
  }

  return { rows, totalPieces, personalPieces, totalValue };
}

export interface StockStatus {
  number: number;
  /** Pezzi ordinati dai CLIENTI (gli ordini 'personal' non toccano il magazzino). */
  ordered: number;
  /** Pezzi negli ordini CLIENTE con pickedUp = true. */
  pickedUp: number;
  /** Giacenza residua = initialStock − pickedUp. */
  residual: number;
  /** initialStock − ordered. Se < 0 il prodotto è SCOPERTO (ammanco). */
  delta: number;
}

/**
 * Stato di magazzino per ogni prodotto del catalogo.
 * È il RITIRO (dei clienti) a scalare la giacenza, non il pagamento.
 * Gli ordini per uso personale sono ESCLUSI da ogni calcolo di magazzino: la
 * merce personale viene tolta dalle casse prima della consegna, quindi non è
 * tra i prodotti da ritirare e la giacenza iniziale non la comprende.
 */
export function stockStatus(state: AppState): StockStatus[] {
  const { catalog, buyers } = state;
  return catalog.map((p) => {
    let ordered = 0;
    let pickedUp = 0;
    for (const b of buyers) {
      if (isPersonal(b)) continue; // fuori dal magazzino
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

export interface StockBar extends StockStatus {
  initialStock: number;
  /** Ancora da consegnare = ordered − pickedUp. */
  toDeliver: number;
  /** Da consegnare coperto dalla merce fisica. */
  covered: number;
  /** Da consegnare NON coperto (ammanco). */
  short: number;
  /** Cuscinetto libero oltre gli ordini. */
  cushion: number;
  /** Lunghezza di riferimento della barra = max(initialStock, ordered). */
  reference: number;
}

/**
 * Scomposizione della giacenza per la barra di capacità del Magazzino.
 * I segmenti (pickedUp + covered + short + cushion) sommano sempre a `reference`.
 */
export function stockBars(state: AppState): StockBar[] {
  const initialByNumber = new Map(state.catalog.map((p) => [p.number, p.initialStock]));
  return stockStatus(state).map((s) => {
    const initialStock = initialByNumber.get(s.number) ?? 0;
    const toDeliver = s.ordered - s.pickedUp;
    const covered = Math.min(toDeliver, Math.max(0, initialStock - s.pickedUp));
    const short = Math.max(0, toDeliver - covered);
    const cushion = Math.max(0, initialStock - s.ordered);
    const reference = Math.max(initialStock, s.ordered);
    return { ...s, initialStock, toDeliver, covered, short, cushion, reference };
  });
}
