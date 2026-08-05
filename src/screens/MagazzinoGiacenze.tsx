import { useState, type KeyboardEvent } from 'react';
import { useStore, type Product } from '../lib';
import { Button, ScreenHeader } from '../components';
import styles from './MagazzinoGiacenze.module.css';

function GiacenzaRow({ product }: { product: Product }) {
  const setInitialStock = useStore((s) => s.setInitialStock);
  const [value, setValue] = useState(String(product.initialStock));

  const commit = () => {
    const n = Math.max(0, Math.round(Number(value.replace(',', '.')) || 0));
    setInitialStock(product.number, n);
    setValue(String(n));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  return (
    <div className={styles.row}>
      <div className={styles.ident}>
        <span className={styles.identName}>{product.nameSv}</span>
        <span className={styles.identMeta}>
          #{product.number}
          {product.weight && <span> · {product.weight}</span>}
        </span>
      </div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Giacenza iniziale</span>
        <input
          className={styles.input}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          aria-label={`Giacenza iniziale ${product.nameSv}`}
        />
      </label>
    </div>
  );
}

export function MagazzinoGiacenze({ onDone }: { onDone: () => void }) {
  const catalog = useStore((s) => s.catalog);

  return (
    <>
      <ScreenHeader
        title="Giacenze iniziali"
        subtitle="Inserisci i pezzi ricevuti per ogni prodotto. Le modifiche si salvano subito."
        actions={
          <Button variant="secondary" onClick={onDone}>
            Fatto
          </Button>
        }
      />
      <div className={styles.list}>
        {catalog.map((p) => (
          <GiacenzaRow key={p.number} product={p} />
        ))}
      </div>
    </>
  );
}

export default MagazzinoGiacenze;
