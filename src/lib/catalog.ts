import type { Product } from './types';

/**
 * Il catalogo è una fonte a sé, facilmente sostituibile: un file JSON con
 * { number, nameSv, descIt, photoUrl, price, initialStock } per prodotto,
 * caricato all'avvio da /catalog.json e sostituibile dalla gestione catalogo.
 */

function toProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const number = Number(o.number);
  const nameSv = typeof o.nameSv === 'string' ? o.nameSv.trim() : '';
  const price = Number(o.price);
  if (!Number.isFinite(number) || nameSv === '' || !Number.isFinite(price)) return null;
  const initialStock = Number.isFinite(Number(o.initialStock)) ? Number(o.initialStock) : 0;
  const descIt = typeof o.descIt === 'string' ? o.descIt : '';
  const photoUrl =
    typeof o.photoUrl === 'string' && o.photoUrl.trim() !== '' ? o.photoUrl.trim() : undefined;
  return { number, nameSv, descIt, price, initialStock, photoUrl };
}

/** Estrae e valida un catalogo da dati JSON (array o wrapper `catalog`/`products`/backup). */
export function parseCatalog(data: unknown): Product[] {
  let arr: unknown = data;
  if (!Array.isArray(data) && data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.catalog)) arr = o.catalog;
    else if (Array.isArray(o.products)) arr = o.products;
    else if (o.state && typeof o.state === 'object' && Array.isArray((o.state as Record<string, unknown>).catalog)) {
      arr = (o.state as Record<string, unknown>).catalog;
    }
  }
  if (!Array.isArray(arr)) {
    throw new Error('Formato catalogo non valido: atteso un array di prodotti.');
  }
  const products = arr.map(toProduct).filter((p): p is Product => p !== null);
  if (products.length === 0) throw new Error('Nessun prodotto valido nel file.');
  return products;
}

/** Carica il catalogo di default da /catalog.json. `[]` se non disponibile. */
export async function fetchCatalog(): Promise<Product[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}catalog.json`, { cache: 'no-cache' });
    if (!res.ok) return [];
    return parseCatalog(await res.json());
  } catch {
    return [];
  }
}
