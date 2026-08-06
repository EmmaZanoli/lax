import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusTrap } from './useFocusTrap';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Pannello laterale che scivola da destra (non un modale a tutto schermo). */
export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (visible) panelRef.current?.focus();
  }, [visible]);

  // Intrappola il Tab nel pannello e ripristina il focus alla chiusura.
  useFocusTrap(open, panelRef);

  if (!mounted) return null;

  return (
    <div
      className={`${styles.backdrop} ${visible ? styles.backdropOpen : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={`${styles.panel} ${visible ? styles.panelOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </aside>
    </div>
  );
}

export default Drawer;
