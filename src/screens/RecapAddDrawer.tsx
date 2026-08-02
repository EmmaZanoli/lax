import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Buyer } from '../lib';
import { useStore, orderTotal, formatEuro } from '../lib';
import { Button, useToast } from '../components';
import styles from './Recap.module.css';

export function RecapAddDrawer({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { catalog, addBuyer } = useStore(
    useShallow((s) => ({ catalog: s.catalog, addBuyer: s.addBuyer })),
  );

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const order = useMemo(() => {
    const o: Record<number, number> = {};
    for (const [num, qty] of Object.entries(quantities)) {
      if (Number(qty) > 0) o[Number(num)] = Number(qty);
    }
    return o;
  }, [quantities]);

  const draftBuyer: Buyer = { id: '', name, order, pickedUp: false, payment: 'none' };
  const total = useMemo(() => orderTotal(draftBuyer, catalog), [order, catalog]);

  const canSave = name.trim().length > 0 && Object.keys(order).length > 0;

  const setQty = (num: number, val: number) => {
    setQuantities((prev) => ({ ...prev, [num]: Math.max(0, val) }));
  };

  const handleSave = () => {
    const buyer: Buyer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim() || undefined,
      order,
      pickedUp: false,
      payment: 'none',
    };
    addBuyer(buyer);
    toast.show(`Ordine aggiunto: ${buyer.name}`, 'brass');
    onClose();
  };

  return (
    <div>
      <div className={styles.addForm}>
        <label className={styles.addLabel} htmlFor="add-name">
          Nome
        </label>
        <input
          id="add-name"
          className={styles.addInput}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome del buyer"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
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
          <span className="label">Totale ordine</span>
          <span className={styles.dDueValue}>{formatEuro(total)}</span>
        </div>
      )}

      <div className={styles.addActions}>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          Aggiungi ordine
        </Button>
      </div>
    </div>
  );
}

export default RecapAddDrawer;
