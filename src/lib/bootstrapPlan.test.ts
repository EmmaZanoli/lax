import { describe, it, expect } from 'vitest';
import type { Buyer, Product } from './types';
import { resolveBootstrap, type BootstrapInput } from './bootstrapPlan';

const prod = (number: number, initialStock: number, price = 10): Product => ({
  number,
  nameSv: `P${number}`,
  weight: '1/1',
  descIt: '',
  price,
  initialStock,
});

const buyer = (id: string): Buyer => ({
  id,
  name: id,
  order: { 1: 1 },
  pickedUp: false,
  payment: 'none',
  kind: 'customer',
});

const seedBuyers: Buyer[] = [buyer('seed1')];
const seedStocks: Record<number, number> = { 1: 5, 2: 4 };

/** Base con seed/now fissi; ogni test sovrascrive isDev/firstRun/persisted/fetched. */
const base = (over: Partial<BootstrapInput>): BootstrapInput => ({
  isDev: false,
  firstRun: false,
  persisted: { catalog: [], buyers: [], importedAt: undefined },
  fetched: [],
  seedBuyers,
  seedStocks,
  now: 'NOW',
  ...over,
});

describe('resolveBootstrap — REGRESSIONE: la giacenza sopravvive al refresh', () => {
  // Il bug: a ogni reload il catalogo persistito veniva sovrascritto con
  // /catalog.json (initialStock: 0), azzerando la giacenza. Ora un reload
  // normale NON deve toccare il catalogo persistito.
  const persisted = {
    catalog: [prod(1, 5), prod(2, 4)], // giacenza inserita dall'utente
    buyers: [buyer('b1')],
    importedAt: 'T0',
  };
  const fetched = [prod(1, 0), prod(2, 0)]; // catalog.json spedisce initialStock 0

  it('in produzione (reload normale) non sovrascrive il catalogo persistito', () => {
    expect(resolveBootstrap(base({ isDev: false, firstRun: false, persisted, fetched }))).toEqual({
      action: 'keep',
    });
  });

  it('in sviluppo (numeri prodotto invariati) non sovrascrive il catalogo persistito', () => {
    expect(resolveBootstrap(base({ isDev: true, firstRun: false, persisted, fetched }))).toEqual({
      action: 'keep',
    });
  });
});

describe('resolveBootstrap — primo popolamento', () => {
  it('senza catalogo persistito carica /catalog.json e conserva i buyer', () => {
    const persisted = { catalog: [], buyers: [buyer('imp1')], importedAt: 'T0' };
    const fetched = [prod(1, 0)];
    expect(resolveBootstrap(base({ isDev: false, firstRun: false, persisted, fetched }))).toEqual({
      action: 'replace',
      catalog: fetched,
      buyers: [buyer('imp1')],
      importedAt: 'T0',
    });
  });

  it('al primo avvio in produzione (IndexedDB vuoto) carica il catalogo di default', () => {
    const fetched = [prod(1, 0)];
    expect(resolveBootstrap(base({ isDev: false, firstRun: true, fetched }))).toEqual({
      action: 'replace',
      catalog: fetched,
      buyers: [],
      importedAt: undefined,
    });
  });

  it('senza catalogo persistito e senza /catalog.json non fa nulla', () => {
    expect(resolveBootstrap(base({ isDev: false, firstRun: false, fetched: [] }))).toEqual({
      action: 'keep',
    });
  });
});

describe('resolveBootstrap — seed di sviluppo', () => {
  it('al primo avvio in dev carica seed applicando le giacenze di esempio', () => {
    const fetched = [prod(1, 0), prod(2, 0), prod(3, 0)];
    const plan = resolveBootstrap(base({ isDev: true, firstRun: true, fetched }));
    expect(plan.action).toBe('replace');
    if (plan.action !== 'replace') return;
    expect(plan.buyers).toEqual(seedBuyers);
    expect(plan.importedAt).toBe('NOW');
    // seedStocks dove definito, altrimenti resta il valore del file (0).
    expect(plan.catalog.find((p) => p.number === 1)!.initialStock).toBe(5);
    expect(plan.catalog.find((p) => p.number === 2)!.initialStock).toBe(4);
    expect(plan.catalog.find((p) => p.number === 3)!.initialStock).toBe(0);
  });

  it('in dev senza /catalog.json non fa nulla (niente crash)', () => {
    expect(resolveBootstrap(base({ isDev: true, firstRun: true, fetched: [] }))).toEqual({
      action: 'keep',
    });
  });
});

describe('resolveBootstrap — il reseed dev NON cancella i dati utente', () => {
  const fetched = [prod(1, 0), prod(99, 0)]; // 99 è un numero nuovo ⇒ catalogChanged

  it('IN DEV con buyer/importedAt presenti: cambio numeri in catalog.json ⇒ keep (dati salvi)', () => {
    const persisted = { catalog: [prod(1, 5)], buyers: [buyer('imp1')], importedAt: 'T0' };
    expect(resolveBootstrap(base({ isDev: true, firstRun: false, persisted, fetched }))).toEqual({
      action: 'keep',
    });
  });

  it('IN DEV con solo importedAt (buyer già svuotati): comunque protetto ⇒ keep', () => {
    const persisted = { catalog: [prod(1, 5)], buyers: [], importedAt: 'T0' };
    expect(resolveBootstrap(base({ isDev: true, firstRun: false, persisted, fetched }))).toEqual({
      action: 'keep',
    });
  });

  it('IN DEV senza dati utente (né buyer né import): cambio numeri ⇒ reseed', () => {
    const persisted = { catalog: [prod(1, 5)], buyers: [], importedAt: undefined };
    const plan = resolveBootstrap(base({ isDev: true, firstRun: false, persisted, fetched }));
    expect(plan.action).toBe('replace');
    if (plan.action !== 'replace') return;
    expect(plan.buyers).toEqual(seedBuyers);
    expect(plan.importedAt).toBe('NOW');
  });

  it('IN PRODUZIONE: lo stesso cambio numeri non tocca il persistito', () => {
    const persisted = { catalog: [prod(1, 5)], buyers: [buyer('imp1')], importedAt: 'T0' };
    expect(resolveBootstrap(base({ isDev: false, firstRun: false, persisted, fetched }))).toEqual({
      action: 'keep',
    });
  });
});
