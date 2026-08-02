import { useMemo, useState } from 'react';
import type { Buyer, Product } from '../lib';
import { formatEuro, orderTotal } from '../lib';
import { Button } from '../components';
import { BancoChangeDialog } from './BancoChangeDialog';
import styles from './Banco.module.css';

export type SaveMode = 'cash' | 'pending' | 'received' | 'none';

interface BancoBuyerCardProps {
  buyer: Buyer;
  catalog: Product[];
  onBack: () => void;
  onSave: (mode: SaveMode) => void;
}

const PAY_BUTTONS: { mode: Exclude<SaveMode, 'none'>; label: string; tone: string }[] = [
  { mode: 'cash', label: 'Contanti', tone: 'cash' },
  { mode: 'pending', label: 'Bonifico atteso', tone: 'pending' },
  { mode: 'received', label: 'Bonifico già fatto', tone: 'received' },
];

const MODE_LABEL: Record<SaveMode, string> = {
  cash: 'Contanti',
  pending: 'Bonifico atteso',
  received: 'Bonifico già fatto',
  none: 'Solo ritiro',
};

export function BancoBuyerCard({ buyer, catalog, onBack, onSave }: BancoBuyerCardProps) {
  const [mode, setMode] = useState<SaveMode | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);

  const total = useMemo(() => orderTotal(buyer, catalog), [buyer, catalog]);

  const lines = useMemo(
    () =>
      Object.entries(buyer.order)
        .map(([num, qty]) => {
          const number = Number(num);
          const product = catalog.find((p) => p.number === number);
          const price = product?.price ?? 0;
          return { number, qty, product, amount: qty * price };
        })
        .sort((a, b) => a.number - b.number),
    [buyer, catalog],
  );

  const choose = (m: SaveMode) => {
    setMode(m);
    if (m !== 'cash') setChangeOpen(false);
  };

  return (
    <div className={styles.detail}>
      <button type="button" className={styles.back} onClick={onBack}>
        ← Cerca un altro nome
      </button>

      <div className={styles.card}>
        <div className={styles.buyerHead}>
          <h2 className={styles.buyerName}>{buyer.name}</h2>
          {buyer.phone && <span className={styles.buyerPhone}>{buyer.phone}</span>}
        </div>

        <ul className={styles.orderList}>
          {lines.map((l) => (
            <li key={l.number} className={styles.orderLine}>
              <div className={styles.olMain}>
                <span className={styles.olName}>
                  {l.product ? l.product.nameSv : `#${l.number}`}
                  {l.product?.weight && (
                    <span className={styles.olWeight}> · {l.product.weight}</span>
                  )}
                  <span className={styles.olNum}>#{l.number}</span>
                </span>
                {l.product?.descIt && <span className={styles.olDesc}>{l.product.descIt}</span>}
                {!l.product && <span className={styles.olDesc}>fuori catalogo</span>}
              </div>
              <span className={styles.olQty}>×{l.qty}</span>
              <span className={styles.olAmount}>{formatEuro(l.amount)}</span>
            </li>
          ))}
        </ul>

        <div className={styles.dueBand}>
          <span className={`label ${styles.dueLabel}`}>Deve pagare</span>
          <span className={styles.dueValue}>{formatEuro(total)}</span>
        </div>

        <h3 className={styles.payTitle}>Come ha pagato?</h3>
        <div className={styles.payGrid}>
          {PAY_BUTTONS.map((b) => (
            <button
              key={b.mode}
              type="button"
              className={styles.payBtn}
              data-tone={b.tone}
              data-selected={mode === b.mode}
              aria-pressed={mode === b.mode}
              onClick={() => choose(b.mode)}
            >
              {b.label}
            </button>
          ))}
        </div>

        {mode === 'cash' && (
          <div className={styles.changeRow}>
            <Button variant="secondary" onClick={() => setChangeOpen(true)}>
              Calcola resto
            </Button>
          </div>
        )}

        <button
          type="button"
          className={styles.payNone}
          data-selected={mode === 'none'}
          aria-pressed={mode === 'none'}
          onClick={() => choose('none')}
        >
          Solo ritiro, pagamento non registrato
        </button>

        <div className={styles.saveWrap}>
          <Button
            variant="primary"
            className={styles.saveBtn}
            disabled={mode === null}
            onClick={() => mode !== null && onSave(mode)}
          >
            Salva e archivia
          </Button>
          <p className={styles.saveHint}>
            {mode === null
              ? 'Scegli come ha pagato per salvare'
              : mode === 'none'
                ? 'Verrà registrato solo il ritiro'
                : `Verrà registrato: ritiro · ${MODE_LABEL[mode]}`}
          </p>
        </div>
      </div>

      {changeOpen && <BancoChangeDialog total={total} onClose={() => setChangeOpen(false)} />}
    </div>
  );
}

export default BancoBuyerCard;
