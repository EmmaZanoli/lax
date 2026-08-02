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
        subtitle="Anagrafica del catalogo: nome svedese, numero, descrizione italiana e prezzo."
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
            description="Il catalogo di default arriva da catalog.json; puoi anche caricarne uno dalla gestione."
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
              <div className={styles.cards}>
                {products.map((p) => <ProductCard key={p.number} p={p} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.cards}>
          {catalog.map((p) => <ProductCard key={p.number} p={p} />)}
        </div>
      )}
    </>
  );
}

function ProductCard({ p }: { p: Product }) {
  return (
    <article className={styles.card}>
      <div className={styles.photo}>
        {p.photoUrl ? (
          <img className={styles.img} src={p.photoUrl} alt={p.nameSv} loading="lazy" />
        ) : (
          <span className={styles.monogram} aria-hidden="true">
            {p.nameSv.charAt(0)}
          </span>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.topline}>
          <h2 className={styles.name}>{p.nameSv}</h2>
          {p.weight && <span className={styles.weightBadge}>{p.weight}</span>}
          <span className={styles.number}>#{p.number}</span>
        </div>
        <p className={styles.desc}>{p.descIt || '—'}</p>
        <span className={styles.price}>{formatEuro(p.price)}</span>
      </div>
    </article>
  );
}

export default Prodotti;
