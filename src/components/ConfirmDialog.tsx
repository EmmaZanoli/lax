import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { useFocusTrap } from './useFocusTrap';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  /** Etichetta del pulsante di conferma (primo click). */
  confirmLabel: string;
  /** Etichetta della SECONDA conferma (doppia conferma per azioni distruttive). */
  armedLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Dialog di conferma con doppia conferma per azioni distruttive. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  armedLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [armed, setArmed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(true, dialogRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
        {armed && (
          <p className={styles.armedNote}>Sei sicuro? L'azione si può comunque annullare con «Annulla ultima azione».</p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <button
            type="button"
            className={armed ? styles.confirmArmed : styles.confirm}
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              onConfirm();
            }}
          >
            {armed ? armedLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
