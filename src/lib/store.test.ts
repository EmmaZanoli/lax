import { beforeEach, describe, it, expect, vi } from 'vitest';

// Lo store persiste su IndexedDB via idb-keyval. In ambiente node non esiste
// IndexedDB: mockiamo idb-keyval in-memory così le azioni non falliscono sulla
// scrittura di persistenza. Qui testiamo la LOGICA delle azioni e l'invariante
// forte del dominio (payment ≠ none ⇒ pickedUp), non la persistenza.
vi.mock('idb-keyval', () => {
  const mem = new Map<string, unknown>();
  return {
    get: async (k: string) => mem.get(k) ?? null,
    set: async (k: string, v: unknown) => {
      mem.set(k, v);
    },
    del: async (k: string) => {
      mem.delete(k);
    },
  };
});

import { useStore } from './store';
import type { Buyer, Product } from './types';

const p = (number: number, price: number, initialStock = 0): Product => ({
  number,
  nameSv: `P${number}`,
  weight: '1/1',
  descIt: '',
  price,
  initialStock,
});

const b = (over: Partial<Buyer>): Buyer => ({
  id: 'id',
  name: 'n',
  order: {},
  pickedUp: false,
  payment: 'none',
  kind: 'customer',
  ...over,
});

const get = () => useStore.getState();
const find = (id: string) => get().buyers.find((x) => x.id === id)!;

/** L'invariante forte: un pagamento registrato implica sempre il ritiro. */
const invariantHolds = () =>
  get().buyers.every((x) => x.payment === 'none' || x.pickedUp);

beforeEach(() => {
  useStore.setState({
    catalog: [p(1, 10, 5), p(2, 20, 3)],
    buyers: [b({ id: 'a', order: { 1: 1 } })],
    importedAt: undefined,
    _snapshot: null,
    canUndo: false,
    lastBackupAt: undefined,
    lastMutatedAt: undefined,
  });
});

describe('setPayment — invariante pagamento ⇒ ritiro', () => {
  it('registrare un pagamento segna anche il ritiro', () => {
    get().setPayment('a', 'cash');
    expect(find('a')).toMatchObject({ pickedUp: true, payment: 'cash' });
    expect(invariantHolds()).toBe(true);
  });
  it('cambiare pagamento mantiene il ritiro', () => {
    get().setPayment('a', 'pending');
    get().setPayment('a', 'received');
    expect(find('a')).toMatchObject({ pickedUp: true, payment: 'received' });
  });
});

describe('setPickup — annullare il ritiro azzera il pagamento', () => {
  it('ritirare mantiene il pagamento esistente', () => {
    useStore.setState({
      buyers: [b({ id: 'a', order: { 1: 1 }, pickedUp: true, payment: 'cash' })],
    });
    get().setPickup('a', true);
    expect(find('a')).toMatchObject({ pickedUp: true, payment: 'cash' });
  });
  it("annullare il ritiro riporta il pagamento a none e mantiene l'invariante", () => {
    useStore.setState({
      buyers: [b({ id: 'a', order: { 1: 1 }, pickedUp: true, payment: 'cash' })],
    });
    get().setPickup('a', false);
    expect(find('a')).toMatchObject({ pickedUp: false, payment: 'none' });
    expect(invariantHolds()).toBe(true);
  });
  it("l'invariante regge dopo la sequenza pagamento → annulla ritiro", () => {
    get().setPayment('a', 'received');
    get().setPickup('a', false);
    expect(find('a')).toMatchObject({ pickedUp: false, payment: 'none' });
    expect(invariantHolds()).toBe(true);
  });
});

describe('undo — un solo livello, snapshot prima di ogni mutazione', () => {
  it('ripristina lo stato precedente e disattiva canUndo', () => {
    get().setPayment('a', 'cash');
    expect(get().canUndo).toBe(true);
    get().undo();
    expect(find('a')).toMatchObject({ pickedUp: false, payment: 'none' });
    expect(get().canUndo).toBe(false);
  });
  it("annulla solo l'ultima mutazione (un livello)", () => {
    get().setPayment('a', 'cash'); //   a: ritirato, contanti
    get().setPickup('a', false); //     a: da ritirare, non pagato
    get().undo(); //                    torna a: ritirato, contanti
    expect(find('a')).toMatchObject({ pickedUp: true, payment: 'cash' });
  });
  it('senza snapshot è un no-op', () => {
    const before = get().buyers;
    get().undo();
    expect(get().buyers).toBe(before);
    expect(get().canUndo).toBe(false);
  });
});

describe('azioni sui dati — importData / addBuyer / resetDay / clearAll', () => {
  it('importData sostituisce i buyer, imposta importedAt e abilita undo', () => {
    get().importData([b({ id: 'x', order: { 2: 1 } })]);
    expect(get().buyers.map((x) => x.id)).toEqual(['x']);
    expect(get().importedAt).toBeTypeOf('string');
    expect(get().canUndo).toBe(true);
  });
  it('importData può aggiornare anche il catalogo', () => {
    get().importData([], [p(9, 99, 1)]);
    expect(get().catalog.map((x) => x.number)).toEqual([9]);
  });
  it('addBuyer aggiunge in coda senza toccare gli altri', () => {
    get().addBuyer(b({ id: 'z', order: { 1: 1 } }));
    expect(get().buyers.map((x) => x.id)).toEqual(['a', 'z']);
  });
  it('deleteBuyer rimuove il buyer indicato e abilita undo', () => {
    get().addBuyer(b({ id: 'z', order: { 1: 1 } }));
    get().deleteBuyer('a');
    expect(get().buyers.map((x) => x.id)).toEqual(['z']);
    expect(get().canUndo).toBe(true);
  });
  it('undo ripristina un buyer eliminato (delete annullabile)', () => {
    get().deleteBuyer('a');
    expect(get().buyers).toEqual([]);
    get().undo();
    expect(get().buyers.map((x) => x.id)).toEqual(['a']);
  });
  it('resetDay azzera i buyer ma conserva il catalogo', () => {
    get().resetDay();
    expect(get().buyers).toEqual([]);
    expect(get().catalog.length).toBe(2);
    expect(get().importedAt).toBeUndefined();
  });
  it('clearAll azzera buyer e catalogo', () => {
    get().clearAll();
    expect(get().buyers).toEqual([]);
    expect(get().catalog).toEqual([]);
  });
  it('undo ripristina i buyer dopo un import', () => {
    get().importData([b({ id: 'x', order: { 2: 1 } })]);
    get().undo();
    expect(get().buyers.map((x) => x.id)).toEqual(['a']);
  });
});

describe('metadati di backup — lastMutatedAt / lastBackupAt', () => {
  it('una mutazione aggiorna lastMutatedAt', () => {
    expect(get().lastMutatedAt).toBeUndefined();
    get().setPayment('a', 'cash');
    expect(get().lastMutatedAt).toBeTypeOf('string');
  });
  it('anche undo conta come modifica (aggiorna lastMutatedAt)', () => {
    get().setPayment('a', 'cash');
    useStore.setState({ lastMutatedAt: undefined });
    get().undo();
    expect(get().lastMutatedAt).toBeTypeOf('string');
  });
  it('markBackedUp registra il momento del backup senza toccare i dati', () => {
    expect(get().lastBackupAt).toBeUndefined();
    const buyersBefore = get().buyers;
    get().markBackedUp();
    expect(get().lastBackupAt).toBeTypeOf('string');
    expect(get().buyers).toBe(buyersBefore);
    expect(get().canUndo).toBe(false);
  });
});
