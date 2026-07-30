import { useState } from 'react';
import { useStore, formatEuro } from '../lib';
import { Button, EmptyState, Panel, ScreenHeader } from '../components';
import { ProdottiManage } from './ProdottiManage';
import styles from './Prodotti.module.css';

export function Prodotti() {
  const catalog = useStore((s) => s.catalog);
  const [manage, setManage] = useState(false);

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
      ) : (
        <div className={styles.cards}>
          {catalog.map((p) => (
            <article key={p.number} className={styles.card}>
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
                  <span className={styles.number}>#{p.number}</span>
                </div>
                <p className={styles.desc}>{p.descIt || '—'}</p>
                <span className={styles.price}>{formatEuro(p.price)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export default Prodotti;
