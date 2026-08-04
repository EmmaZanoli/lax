import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PaymentStatus } from '../lib';
import { useStore, orderTotal, formatEuro, isPersonal } from '../lib';
import { Button, Chip, useToast } from '../components';
import { BancoChangeDialog } from './BancoChangeDialog';
import styles from './Recap.module.css';

const PAYMENTS: { mode: PaymentStatus; label: string; tone: string }[] = [
  { mode: 'none', label: 'Non pagato', tone: 'unpaid' },
  { mode: 'cash', label: 'Contanti', tone: 'cash' },
  { mode: 'pending', label: 'Bonifico atteso', tone: 'pending' },
  { mode: 'received', label: 'Bonifico ricevuto', tone: 'received' },
];

const PAYMENT_TOAST: Record<PaymentStatus, string> = {
  none: 'ritirato, non pagato',
  cash: 'contanti',
  pending: 'bonifico atteso',
  received: 'bonifico ricevuto',
};

export function RecapOrderDrawer({ id }: { id: string }) {
  const toast = useToast();
  const { buyer, catalog, setPayment, setPickup } = useStore(
    useShallow((s) => ({
      buyer: s.buyers.find((b) => b.id === id),
      catalog: s.catalog,
      setPayment: s.setPayment,
      setPickup: s.setPickup,
    })),
  );
  const [changeOpen, setChangeOpen] = useState(false);

  const total = useMemo(() => (buyer ? orderTotal(buyer, catalog) : 0), [buyer, catalog]);
  const lines = useMemo(
    () =>
      buyer
        ? Object.entries(buyer.order)
            .map(([num, qty]) => {
              const number = Number(num);
              const product = catalog.find((p) => p.number === number);
              return { number, qty, product, amount: qty * (product?.price ?? 0) };
            })
            .sort((a, b) => a.number - b.number)
        : [],
    [buyer, catalog],
  );

  if (!buyer) return null;

  const personal = isPersonal(buyer);
  const activePayment: PaymentStatus | null = buyer.pickedUp ? buyer.payment : null;

  const togglePickup = (value: boolean) => {
    if (value === buyer.pickedUp) return;
    setPickup(id, value);
    toast.show(`${buyer.name}: ${value ? 'ritirato' : 'da ritirare'}`, 'brass');
    if (!value) setChangeOpen(false);
  };

  const choosePayment = (mode: PaymentStatus) => {
    setPayment(id, mode);
    toast.show(`${buyer.name}: ${PAYMENT_TOAST[mode]}`, 'brass');
    if (mode !== 'cash') setChangeOpen(false);
  };

  return (
    <div>
      <div className={styles.dHead}>
        <h3 className={styles.dName}>{buyer.name}</h3>
        {personal ? (
          <Chip tone="personal">Uso personale</Chip>
        ) : (
          buyer.phone && <span className={styles.dPhone}>{buyer.phone}</span>
        )}
      </div>

      <ul className={styles.dOrder}>
        {lines.map((l) => (
          <li key={l.number} className={styles.dLine}>
            <span className={styles.dlName}>
              {l.product ? l.product.nameSv : `#${l.number}`}
              {l.product?.weight && (
                <span className={styles.dlWeight}> · {l.product.weight}</span>
              )}
              <span className={styles.dlNum}>#{l.number}</span>
            </span>
            <span className={styles.dlQty}>×{l.qty}</span>
            <span className={styles.dlAmount}>{formatEuro(l.amount)}</span>
          </li>
        ))}
      </ul>

      <div className={styles.dDue}>
        <span className="label">{personal ? 'Valore uso personale' : 'Totale ordine'}</span>
        <span className={styles.dDueValue}>{formatEuro(total)}</span>
      </div>

      {personal ? (
        <p className={styles.addNote}>
          Merce per uso personale del seller: non entra nella coda ritiri, nei bucket di denaro
          dei clienti né nella quadratura. Scala comunque la giacenza nel Magazzino.
        </p>
      ) : (
        <>
          <h4 className={styles.dSection}>Ritiro</h4>
          <div className={styles.pickToggle} role="group" aria-label="Stato ritiro">
            <button
              type="button"
              className={styles.pickBtn}
              data-active={!buyer.pickedUp}
              onClick={() => togglePickup(false)}
            >
              Da ritirare
            </button>
            <button
              type="button"
              className={styles.pickBtn}
              data-active={buyer.pickedUp}
              onClick={() => togglePickup(true)}
            >
              Ritirato
            </button>
          </div>

          <h4 className={styles.dSection}>Pagamento</h4>
          <div className={styles.payGrid}>
            {PAYMENTS.map((p) => (
              <button
                key={p.mode}
                type="button"
                className={styles.payBtn}
                data-tone={p.tone}
                data-selected={activePayment === p.mode}
                aria-pressed={activePayment === p.mode}
                onClick={() => choosePayment(p.mode)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {activePayment === 'cash' && (
            <div className={styles.changeRow}>
              <Button variant="secondary" onClick={() => setChangeOpen(true)}>
                Calcola resto
              </Button>
            </div>
          )}

          {changeOpen && <BancoChangeDialog total={total} onClose={() => setChangeOpen(false)} />}
        </>
      )}
    </div>
  );
}

export default RecapOrderDrawer;
