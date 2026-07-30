import { useEffect, useRef, useState } from 'react';
import { formatEuro } from '../lib';
import { Button } from '../components';
import styles from './Banco.module.css';

interface BancoChangeDialogProps {
  total: number;
  onClose: () => void;
}

function parseCash(raw: string): number | null {
  const cleaned = raw.replace(',', '.').replace(/[^\d.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Piccolo dialog effimero per il calcolo del resto: non salva nulla. */
export function BancoChangeDialog({ total, onClose }: BancoChangeDialogProps) {
  const [cash, setCash] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const received = parseCash(cash);
  const change = received == null ? null : received - total;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Calcola resto">
        <h2 className={styles.dialogTitle}>Calcola resto</h2>

        <div className={styles.dialogRow}>
          <span className="label">Deve pagare</span>
          <span className={styles.dialogTotal}>{formatEuro(total)}</span>
        </div>

        <label className={styles.dialogField}>
          <span className="label">Contanti ricevuti</span>
          <input
            ref={inputRef}
            className={styles.dialogInput}
            inputMode="decimal"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            placeholder="0,00"
          />
        </label>

        <div className={styles.dialogRow}>
          <span className="label">Resto</span>
          {change == null ? (
            <span className={styles.restoMuted}>—</span>
          ) : change >= 0 ? (
            <span className={styles.resto}>{formatEuro(change)}</span>
          ) : (
            <span className={styles.restoNeg}>mancano {formatEuro(-change)}</span>
          )}
        </div>

        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BancoChangeDialog;
