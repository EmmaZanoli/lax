import { useMemo, useState } from 'react';
import { useStore, formatEuro } from '../lib';
import type { Product } from '../lib';
import { Button, EmptyState, Panel, ScreenHeader } from '../components';
import { ProdottiManage } from './ProdottiManage';
import styles from './Prodotti.module.css';

function groupByCategory(catalog: Product[]): [string, Product[]][] {
  const map = new Map<string, Product[]>();
  for (const p of catalog) {
    const cat = p.category ?? 'Altro';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(p);
  }
  return Array.from(map.entries());
}

function ProductRow({ p }: { p: Product }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowNum}>
        <span className={styles.rowNumHash}>#</span>
        <span className={styles.rowNumVal}>{p.number}</span>
      </div>
      <div className={styles.rowInfo}>
        <div className={styles.rowNameLine}>
          <span className={styles.rowName}>{p.nameSv}</span>
          {p.weight && <span className={styles.rowWeight}> · {p.weight}</span>}
        </div>
        {p.descIt && <p className={styles.rowDesc}>{p.descIt}</p>}
      </div>
      <span className={styles.rowPrice}>{formatEuro(p.price)}</span>
    </div>
  );
}

export function Prodotti() {
  const catalog = useStore((s) => s.catalog);
  const [manage, setManage] = useState(false);

  const grouped = useMemo(() => groupByCategory(catalog), [catalog]);
  const hasCategories = catalog.some((p) => p.category);

  if (manage) {
    return <ProdottiManage onDone={() => setManage(false)} />;
  }

  return (
    <>
      <ScreenHeader
        title="Prodotti"
        subtitle="Anagrafica del catalogo: numero di scatola, nome svedese, formato e prezzo."
        actions={
          <Button variant="secondary" onClick={() => setManage(true)}>
            <span aria-hidden="true">⚙</span> Gestione catalogo
          </Button>
        }
      />

      {catalog.length === 0 ? (
        <Panel>
          <EmptyState
            glyph="❦"
            title="Catalogo vuoto"
            description="Nessun prodotto nel catalogo. Usa la gestione catalogo per caricarne uno."
          >
            <Button variant="primary" onClick={() => setManage(true)}>
              Apri gestione catalogo
            </Button>
          </EmptyState>
        </Panel>
      ) : hasCategories ? (
        <div className={styles.catalog}>
          {grouped.map(([category, products]) => (
            <section key={category} className={styles.group}>
              <h3 className={styles.groupTitle}>{category}</h3>
              <div className={styles.table}>
                {products.map((p) => <ProductRow key={p.number} p={p} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.table}>
          {catalog.map((p) => <ProductRow key={p.number} p={p} />)}
        </div>
      )}
    </>
  );
}

export default Prodotti;
