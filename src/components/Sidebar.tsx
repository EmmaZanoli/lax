import { NavLink } from 'react-router-dom';
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

/** Numeri live in fondo alla nav — per ora valori placeholder (nessun import). */
const liveNumbers = [
  { label: 'Contanti', value: '€ 0,00', tone: 'cash' as const },
  { label: 'Bonifici attesi', value: '€ 0,00', tone: 'pending' as const },
  { label: 'Da ritirare', value: '0', tone: 'neutral' as const },
];

export function Sidebar() {
  const toast = useToast();

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
        {liveNumbers.map((n) => (
          <div key={n.label} className={styles.liveRow} data-tone={n.tone}>
            <span className="label">{n.label}</span>
            <span className={styles.liveValue}>{n.value}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={styles.undo}
        onClick={() => toast.show('Niente da annullare')}
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
