import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Buyer, OrderKind } from '../lib';
import { useStore, orderTotal, formatEuro } from '../lib';
import { Button, useToast } from '../components';
import styles from './Recap.module.css';

/** Nome di default per un ordine per uso personale senza etichetta. */
const PERSONAL_FALLBACK = 'Uso personale';

export function RecapAddDrawer({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { catalog, addBuyer } = useStore(
    useShallow((s) => ({ catalog: s.catalog, addBuyer: s.addBuyer })),
  );

  const [kind, setKind] = useState<OrderKind>('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const isPersonal = kind === 'personal';

  const order = useMemo(() => {
    const o: Record<number, number> = {};
    for (const [num, qty] of Object.entries(quantities)) {
      if (Number(qty) > 0) o[Number(num)] = Number(qty);
    }
    return o;
  }, [quantities]);

  const draftBuyer: Buyer = { id: '', name, order, pickedUp: false, payment: 'none', kind };
  const total = useMemo(() => orderTotal(draftBuyer, catalog), [order, catalog]);

  // Per l'uso personale il nome è facoltativo (default "Uso personale").
  const canSave =
    Object.keys(order).length > 0 && (isPersonal || name.trim().length > 0);

  const setQty = (num: number, val: number) => {
    setQuantities((prev) => ({ ...prev, [num]: Math.max(0, val) }));
  };

  const handleSave = () => {
    const finalName = isPersonal ? name.trim() || PERSONAL_FALLBACK : name.trim();
    const buyer: Buyer = {
      id: crypto.randomUUID(),
      name: finalName,
      phone: isPersonal ? undefined : phone.trim() || undefined,
      order,
      pickedUp: false,
      payment: 'none',
      kind,
    };
    addBuyer(buyer);
    toast.show(
      isPersonal ? `Uso personale aggiunto: ${finalName}` : `Ordine aggiunto: ${finalName}`,
      'brass',
    );
    onClose();
  };

  return (
    <div>
      <div
        className={`${styles.pickToggle} ${styles.addKindToggle}`}
        role="group"
        aria-label="Tipo di ordine"
      >
        <button
          type="button"
          className={styles.pickBtn}
          data-active={kind === 'customer'}
          onClick={() => setKind('customer')}
        >
          Cliente
        </button>
        <button
          type="button"
          className={styles.pickBtn}
          data-active={kind === 'personal'}
          onClick={() => setKind('personal')}
        >
          Uso personale
        </button>
      </div>

      {isPersonal && (
        <p className={styles.addNote}>
          Merce che tieni per te: fuori dai conti del giorno e dalla coda ritiri, ma scala
          comunque la giacenza.
        </p>
      )}

      <div className={styles.addForm}>
        <label className={styles.addLabel} htmlFor="add-name">
          {isPersonal ? 'Etichetta (facoltativa)' : 'Nome'}
        </label>
        <input
          id="add-name"
          className={styles.addInput}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isPersonal ? PERSONAL_FALLBACK : 'Nome del buyer'}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
        {!isPersonal && (
          <>
            <label className={styles.addLabel} htmlFor="add-phone">
              Telefono
            </label>
            <input
              id="add-phone"
              className={styles.addInput}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Opzionale"
            />
          </>
        )}
      </div>

      <h4 className={styles.dSection}>Prodotti</h4>

      {catalog.length === 0 ? (
        <p className={styles.addEmpty}>Nessun prodotto nel catalogo.</p>
      ) : (
        <ul className={styles.dOrder}>
          {catalog.map((p) => {
            const qty = quantities[p.number] ?? 0;
            return (
              <li key={p.number} className={styles.addLine} data-active={qty > 0}>
                <span className={styles.dlName}>
                  {p.nameSv}
                  {p.weight && <span className={styles.dlWeight}> · {p.weight}</span>}
                  <span className={styles.dlNum}>#{p.number}</span>
                </span>
                <span className={styles.addLinePrice}>{formatEuro(p.price)}</span>
                <span className={styles.addQtyRow}>
                  <button
                    type="button"
                    className={styles.addQtyBtn}
                    onClick={() => setQty(p.number, qty - 1)}
                    disabled={qty === 0}
                    aria-label={`Riduci quantità ${p.nameSv}`}
                  >
                    −
                  </button>
                  <span className={styles.addQtyVal}>{qty}</span>
                  <button
                    type="button"
                    className={styles.addQtyBtn}
                    onClick={() => setQty(p.number, qty + 1)}
                    aria-label={`Aumenta quantità ${p.nameSv}`}
                  >
                    +
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {total > 0 && (
        <div className={styles.dDue}>
          <span className="label">{isPersonal ? 'Valore uso personale' : 'Totale ordine'}</span>
          <span className={styles.dDueValue}>{formatEuro(total)}</span>
        </div>
      )}

      <div className={styles.addActions}>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          {isPersonal ? 'Aggiungi uso personale' : 'Aggiungi ordine'}
        </Button>
      </div>
    </div>
  );
}

export default RecapAddDrawer;
