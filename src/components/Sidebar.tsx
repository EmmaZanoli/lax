import { NavLink } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore, totals, formatEuro } from '../lib';
import { useToast } from './Toast';
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

  // Numeri live agganciati ai selettori derivati.
  const live = useStore(
    useShallow((s) => {
      const t = totals(s);
      return { cash: t.cash, pending: t.pending, toPick: t.toPickCount };
    }),
  );

  const canUndo = useStore((s) => s.canUndo);
  const undo = useStore((s) => s.undo);

  const handleUndo = () => {
    undo();
    toast.show('Ultima azione annullata');
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandDot} aria-hidden="true" />
        <span className={styles.brandName}>lax</span>
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
                {it.label}
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
    </aside>
  );
}

export default Sidebar;
