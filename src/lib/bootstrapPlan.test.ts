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

const base = (over: Partial<BootstrapInput> = {}): BootstrapInput => ({
  persisted: { catalog: [], buyers: [], importedAt: undefined },
  fetched: [],
  ...over,
});

describe('resolveBootstrap — REGRESSIONE: la giacenza sopravvive al refresh', () => {
  // Il bug: a ogni reload il catalogo persistito veniva sovrascritto con
  // /catalog.json (initialStock: 0), azzerando la giacenza. Un reload normale
  // NON deve toccare il catalogo persistito.
  const persisted = {
    catalog: [prod(1, 5), prod(2, 4)], // giacenza inserita dall'utente
    buyers: [buyer('b1')],
    importedAt: 'T0',
  };
  const fetched = [prod(1, 0), prod(2, 0)]; // catalog.json spedisce initialStock 0

  it('non sovrascrive il catalogo persistito a un reload', () => {
    expect(resolveBootstrap(base({ persisted, fetched }))).toEqual({ action: 'keep' });
  });
});

describe('resolveBootstrap — primo popolamento', () => {
  it('senza catalogo persistito carica /catalog.json e conserva i buyer', () => {
    const persisted = { catalog: [], buyers: [buyer('imp1')], importedAt: 'T0' };
    const fetched = [prod(1, 0)];
    expect(resolveBootstrap(base({ persisted, fetched }))).toEqual({
      action: 'replace',
      catalog: fetched,
      buyers: [buyer('imp1')],
      importedAt: 'T0',
    });
  });

  it('al primo avvio (IndexedDB vuoto) carica il catalogo di default', () => {
    const fetched = [prod(1, 0)];
    expect(resolveBootstrap(base({ fetched }))).toEqual({
      action: 'replace',
      catalog: fetched,
      buyers: [],
      importedAt: undefined,
    });
  });

  it('senza catalogo persistito e senza /catalog.json non fa nulla', () => {
    expect(resolveBootstrap(base())).toEqual({ action: 'keep' });
  });
});
