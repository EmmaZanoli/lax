import { describe, it, expect } from 'vitest';
import type { AppState, Buyer, Product } from './types';
import {
  isCustomer,
  isPersonal,
  orderTotal,
  orderPieces,
  totals,
  pickedUpValue,
  orderedTotals,
  stockStatus,
  stockBars,
} from './selectors';
import { isBalanced } from './export';

// Factory prodotto: prezzo e giacenza espliciti, resto placeholder.
const p = (number: number, price: number, initialStock = 0): Product => ({
  number,
  nameSv: `P${number}`,
  weight: '1/1',
  descIt: '',
  price,
  initialStock,
});

// Factory buyer: cliente non ritirato / non pagato di default, sovrascrivibile.
const b = (over: Partial<Buyer>): Buyer => ({
  id: 'id',
  name: 'n',
  order: {},
  pickedUp: false,
  payment: 'none',
  kind: 'customer',
  ...over,
});

describe('isCustomer / isPersonal', () => {
  it('distinguono per kind', () => {
    expect(isPersonal(b({ kind: 'personal' }))).toBe(true);
    expect(isCustomer(b({ kind: 'personal' }))).toBe(false);
    expect(isCustomer(b({ kind: 'customer' }))).toBe(true);
  });
  it('robusti verso dati vecchi senza kind: contano come cliente', () => {
    const legacy = { id: 'l', name: 'l', order: {}, pickedUp: false, payment: 'none' } as unknown as Buyer;
    expect(isCustomer(legacy)).toBe(true);
    expect(isPersonal(legacy)).toBe(false);
  });
});

describe('orderTotal — sempre coi prezzi di catalogo', () => {
  const catalog = [p(1, 10), p(2, 20)];
  it('somma quantità × prezzo di catalogo', () => {
    expect(orderTotal(b({ order: { 1: 2, 2: 1 } }), catalog)).toBe(40);
  });
  it('ignora i numeri non in catalogo (prezzo 0)', () => {
    expect(orderTotal(b({ order: { 1: 1, 99: 5 } }), catalog)).toBe(10);
  });
  it('ordine vuoto = 0', () => {
    expect(orderTotal(b({ order: {} }), catalog)).toBe(0);
  });
});

describe('orderPieces', () => {
  it('somma le quantità', () => {
    expect(orderPieces(b({ order: { 1: 2, 2: 3 } }))).toBe(5);
    expect(orderPieces(b({ order: {} }))).toBe(0);
  });
});

describe('totals — bucket denaro solo clienti, personale a parte', () => {
  const catalog = [p(1, 10), p(2, 20)];
  const state: AppState = {
    catalog,
    buyers: [
      b({ id: 'cash', order: { 1: 2 }, pickedUp: true, payment: 'cash' }), //     20
      b({ id: 'recv', order: { 2: 1 }, pickedUp: true, payment: 'received' }), // 20
      b({ id: 'pend', order: { 1: 1 }, pickedUp: true, payment: 'pending' }), //  10
      b({ id: 'unpd', order: { 1: 1 }, pickedUp: true, payment: 'none' }), //     10
      b({ id: 'topick', order: { 2: 2 }, pickedUp: false }), //                   40
      b({ id: 'perso', order: { 1: 3 }, kind: 'personal' }), //                   30
    ],
  };
  const t = totals(state);

  it('ripartisce il valore dei clienti ritirati per stato pagamento', () => {
    expect(t.cash).toBe(20);
    expect(t.received).toBe(20);
    expect(t.pending).toBe(10);
    expect(t.unpaid).toBe(10);
  });
  it('conta i clienti da ritirare a parte', () => {
    expect(t.toPickValue).toBe(40);
    expect(t.toPickCount).toBe(1);
  });
  it("tiene l'uso personale fuori dai bucket clienti", () => {
    expect(t.personal).toBe(30);
    expect(t.personalCount).toBe(1);
  });
  it('orderedTotal = valore di TUTTO l ordinato (clienti + personale)', () => {
    expect(t.orderedTotal).toBe(130);
  });
  it('quadratura: pickedUpValue = cash + received + pending + unpaid', () => {
    expect(pickedUpValue(t)).toBe(60);
  });
});

describe('isBalanced — quadratura clienti', () => {
  const catalog = [p(1, 10), p(2, 20)];
  it('vero quando i bucket coprono il valore dei clienti ritirati', () => {
    const state: AppState = {
      catalog,
      buyers: [
        b({ id: '1', order: { 1: 2 }, pickedUp: true, payment: 'cash' }),
        b({ id: '2', order: { 2: 1 }, pickedUp: true, payment: 'none' }),
        b({ id: '3', order: { 1: 1 }, pickedUp: false }),
      ],
    };
    expect(isBalanced(state)).toBe(true);
  });
  it("l'uso personale non rompe la quadratura clienti", () => {
    const state: AppState = {
      catalog,
      buyers: [
        b({ id: '1', order: { 1: 2 }, pickedUp: true, payment: 'cash' }),
        b({ id: 'p', order: { 2: 5 }, kind: 'personal' }),
      ],
    };
    expect(isBalanced(state)).toBe(true);
  });
});

describe('orderedTotals — riconciliazione fattura (clienti + personale)', () => {
  const catalog = [p(1, 10), p(2, 20), p(3, 5)];
  const state: AppState = {
    catalog,
    buyers: [
      b({ id: 'c1', order: { 1: 2 } }),
      b({ id: 'c2', order: { 1: 1, 2: 1 } }),
      b({ id: 'p1', order: { 1: 3, 3: 2 }, kind: 'personal' }),
    ],
  };
  const o = orderedTotals(state);

  it('per prodotto separa pezzi clienti e personale', () => {
    expect(o.rows).toEqual([
      { number: 1, customer: 3, personal: 3, total: 6, value: 60 },
      { number: 2, customer: 1, personal: 0, total: 1, value: 20 },
      { number: 3, customer: 0, personal: 2, total: 2, value: 10 },
    ]);
  });
  it('i totali complessivi includono il personale', () => {
    expect(o.totalPieces).toBe(9);
    expect(o.personalPieces).toBe(5);
    expect(o.totalValue).toBe(90);
  });
  it('esclude i prodotti senza pezzi ordinati', () => {
    const empty = orderedTotals({
      catalog: [p(1, 10), p(7, 99)],
      buyers: [b({ order: { 1: 1 } })],
    });
    expect(empty.rows.map((r) => r.number)).toEqual([1]);
  });
});

describe('stockStatus — solo clienti; è il ritiro a scalare la giacenza', () => {
  const catalog = [p(1, 10, 5), p(2, 20, 3), p(3, 5, 0)];
  const state: AppState = {
    catalog,
    buyers: [
      b({ id: 'a', order: { 1: 2 }, pickedUp: true }),
      b({ id: 'b', order: { 1: 1 }, pickedUp: false }),
      b({ id: 'c', order: { 2: 4 }, pickedUp: true }), // ordinato 4 > giacenza 3
      b({ id: 'perso', order: { 1: 10 }, kind: 'personal' }), // ESCLUSO dal magazzino
    ],
  };
  const byNum = new Map(stockStatus(state).map((r) => [r.number, r]));

  it('ordinato e ritirato contano solo i clienti (personale escluso)', () => {
    expect(byNum.get(1)).toEqual({ number: 1, ordered: 3, pickedUp: 2, residual: 3, delta: 2 });
  });
  it('residual = iniziale − ritirati; delta < 0 = scoperto (ammanco)', () => {
    expect(byNum.get(2)).toEqual({ number: 2, ordered: 4, pickedUp: 4, residual: -1, delta: -1 });
  });
  it('prodotto senza ordini clienti resta a zero', () => {
    expect(byNum.get(3)).toEqual({ number: 3, ordered: 0, pickedUp: 0, residual: 0, delta: 0 });
  });
});

describe('stockBars — i segmenti sommano sempre a reference', () => {
  const catalog = [p(1, 10, 5), p(2, 20, 3), p(3, 5, 10)];
  const state: AppState = {
    catalog,
    buyers: [
      b({ id: 'a', order: { 1: 8 }, pickedUp: false }), // scoperto: ordinato 8 > 5
      b({ id: 'b', order: { 2: 4 }, pickedUp: true }), //  ritirato oltre la giacenza
      b({ id: 'c', order: { 3: 4 }, pickedUp: true }), //  lascia cuscinetto libero
    ],
  };
  const bars = stockBars(state);

  it('pickedUp + covered + short + cushion = reference per ogni prodotto', () => {
    for (const bar of bars) {
      expect(bar.pickedUp + bar.covered + bar.short + bar.cushion).toBe(bar.reference);
    }
  });
  it('scompone un prodotto scoperto con consegne ancora pendenti', () => {
    const one = bars.find((x) => x.number === 1)!;
    expect(one).toMatchObject({
      initialStock: 5,
      ordered: 8,
      pickedUp: 0,
      toDeliver: 8,
      covered: 5,
      short: 3,
      cushion: 0,
      reference: 8,
    });
  });
  it('espone il cuscinetto libero oltre gli ordini', () => {
    const three = bars.find((x) => x.number === 3)!;
    expect(three).toMatchObject({ cushion: 6, short: 0, reference: 10 });
  });
});
