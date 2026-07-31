import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore, totals, formatEuro, stockStatus, downloadRecap, downloadBackup } from '../lib';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  label: string;
}

/** Punto di ingresso: preparazione dei dati (una volta l'anno). */
const setupNav: NavItem[] = [{ to: '/import', label: 'Import' }];

/** Voci di sezione operative. */
const sectionNav: NavItem[] = [
  { to: '/banco', label: 'Banco' },
  { to: '/magazzino', label: 'Magazzino' },
  { to: '/recap', label: 'Recap ordini' },
  { to: '/prodotti', label: 'Prodotti' },
];

function itemClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${styles.item} ${styles.active}` : styles.item;
}

export function Sidebar() {
  const toast = useToast();

  const [collapsed, setCollapsed] = useState(false);

  // Numeri live agganciati ai selettori derivati.
  const live = useStore(
    useShallow((s) => {
      const t = totals(s);
      return { cash: t.cash, pending: t.pending, toPick: t.toPickCount };
    }),
  );

  const scoperti = useStore((s) => stockStatus(s).filter((r) => r.delta < 0).length);

  const canUndo = useStore((s) => s.canUndo);
  const undo = useStore((s) => s.undo);
  const resetDay = useStore((s) => s.resetDay);

  const [resetOpen, setResetOpen] = useState(false);

  const handleUndo = () => {
    undo();
    toast.show('Ultima azione annullata');
  };

  const handleExport = () => {
    downloadRecap(useStore.getState());
    toast.show('Recap esportato', 'brass');
  };
  const handleBackup = () => {
    downloadBackup(useStore.getState());
    toast.show('Backup scaricato', 'brass');
  };
  const handleReset = () => {
    resetDay();
    setResetOpen(false);
    toast.show('Buyer azzerati · catalogo conservato', 'brass');
  };

  return (
    <aside className={`${styles.sidebar}${collapsed ? ` ${styles.collapsed}` : ''}`}>
      <div className={styles.brand}>
        <span className={styles.brandDot} aria-hidden="true" />
        <span className={styles.brandName}>lax</span>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Espandi sidebar' : 'Chiudi sidebar'}
        >
          <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
        </button>
      </div>

      <nav className={styles.nav} aria-label="Navigazione principale">
        <ul className={styles.group}>
          {setupNav.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} className={itemClass}>
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className={styles.divider} role="separator" />

        <ul className={styles.group}>
          {sectionNav.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} className={itemClass}>
                <span>{it.label}</span>
                {it.to === '/magazzino' && scoperti > 0 && (
                  <span className={styles.badge}>{scoperti}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.live} aria-label="Numeri live">
        <div className={styles.liveRow} data-tone="cash">
          <span className="label">Contanti</span>
          <span className={styles.liveValue}>{formatEuro(live.cash)}</span>
        </div>
        <div className={styles.liveRow} data-tone="pending">
          <span className="label">Bonifici attesi</span>
          <span className={styles.liveValue}>{formatEuro(live.pending)}</span>
        </div>
        <div className={styles.liveRow} data-tone="neutral">
          <span className="label">Da ritirare</span>
          <span className={styles.liveValue}>{live.toPick}</span>
        </div>
      </div>

      <div className={styles.tools}>
        <button type="button" className={styles.toolBtn} onClick={handleExport}>
          Esporta recap
        </button>
        <button type="button" className={styles.toolBtn} onClick={handleBackup}>
          Backup
        </button>
      </div>

      <button
        type="button"
        className={styles.undo}
        onClick={handleUndo}
        disabled={!canUndo}
      >
        <span className={styles.undoGlyph} aria-hidden="true">
          ↩
        </span>
        Annulla ultima azione
      </button>

      <button type="button" className={styles.reset} onClick={() => setResetOpen(true)}>
        Nuovo anno · azzera i buyer
      </button>

      {resetOpen && (
        <ConfirmDialog
          title="Nuovo anno"
          confirmLabel="Azzera i buyer"
          armedLabel="Sì, azzera tutti i buyer"
          onConfirm={handleReset}
          onClose={() => setResetOpen(false)}
        >
          Rimuove <strong>tutti i buyer e gli ordini</strong> importati, ma conserva il catalogo
          (prodotti, prezzi e giacenze). Usalo per ricominciare da un nuovo import.
        </ConfirmDialog>
      )}
    </aside>
  );
}

export default Sidebar;
