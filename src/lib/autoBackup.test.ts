import { beforeEach, describe, it, expect, vi } from 'vitest';

// idb-keyval in-memory: in node non c'è IndexedDB. (Vedi anche store.test.ts.)
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

import { loadAutoSnapshots, saveAutoSnapshot, clearAutoSnapshots } from './autoBackup';
import type { Buyer, Product } from './types';

const cat: Product[] = [
  { number: 1, nameSv: 'P1', weight: '', descIt: '', price: 10, initialStock: 0 },
];
const buyer = (id: string): Buyer => ({
  id,
  name: id,
  order: {},
  pickedUp: false,
  payment: 'none',
  kind: 'customer',
});

beforeEach(async () => {
  await clearAutoSnapshots();
});

describe('autoBackup — ring buffer degli snapshot automatici', () => {
  it('parte vuoto', async () => {
    expect(await loadAutoSnapshots()).toEqual([]);
  });

  it('accumula gli snapshot in ordine cronologico', async () => {
    await saveAutoSnapshot({ catalog: cat, buyers: [buyer('a')] }, new Date('2026-08-07T10:00:00Z'));
    const after = await saveAutoSnapshot(
      { catalog: cat, buyers: [buyer('a'), buyer('b')] },
      new Date('2026-08-07T10:03:00Z'),
    );
    expect(after.length).toBe(2);
    expect(after[0].savedAt).toBe('2026-08-07T10:00:00.000Z');
    expect(after[1].buyers.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('tiene solo gli ultimi 20 (i più vecchi vengono scartati)', async () => {
    let last: Awaited<ReturnType<typeof saveAutoSnapshot>> = [];
    for (let i = 0; i < 25; i++) {
      last = await saveAutoSnapshot(
        { catalog: cat, buyers: [buyer(`b${i}`)] },
        new Date(Date.UTC(2026, 7, 7, 10, i)),
      );
    }
    expect(last.length).toBe(20);
    expect(last[0].buyers[0].id).toBe('b5'); // b0..b4 scartati
    expect(last[19].buyers[0].id).toBe('b24');
  });

  it('clearAutoSnapshots svuota tutto', async () => {
    await saveAutoSnapshot({ catalog: cat, buyers: [buyer('a')] });
    await clearAutoSnapshots();
    expect(await loadAutoSnapshots()).toEqual([]);
  });
});
