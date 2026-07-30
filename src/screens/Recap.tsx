import { Button, Chip, EmptyState, Panel, ScreenHeader } from '../components';
import type { ChipTone } from '../components';
import styles from './Recap.module.css';

interface MoneyItem {
  label: string;
  value: string;
  tone: ChipTone;
}

/** Cinque voci denaro. Le prime quattro compongono la quadratura del ritirato. */
const moneyItems: MoneyItem[] = [
  { label: 'Contanti', value: '€ 0,00', tone: 'cash' },
  { label: 'Bonifico ricevuto', value: '€ 0,00', tone: 'received' },
  { label: 'Bonifico atteso', value: '€ 0,00', tone: 'pending' },
  { label: 'Non pagato', value: '€ 0,00', tone: 'unpaid' },
  { label: 'Da ritirare', value: '€ 0,00', tone: 'neutral' },
];

const filters = ['Da ritirare', 'Ritirati', 'Tutti'];

export function Recap() {
  return (
    <>
      <ScreenHeader
        title="Recap ordini"
        subtitle="Tutti gli ordini con la quadratura del denaro. Le righe si modificano nel drawer laterale."
        actions={
          <>
            <Button variant="secondary" disabled>
              Export recap
            </Button>
            <Button variant="secondary" disabled>
              Backup
            </Button>
          </>
        }
      />

      <div className={styles.money}>
        {moneyItems.map((m) => (
          <div key={m.label} className={styles.moneyTile} data-tone={m.tone}>
            <span className="label">{m.label}</span>
            <span className={styles.moneyValue}>{m.value}</span>
          </div>
        ))}
      </div>

      <div className={styles.quadratura}>
        <Chip tone="received">Quadratura ✓</Chip>
        <span className={styles.quadraturaNote}>
          Valore ordini ritirati = contanti + bonifico ricevuto + bonifico atteso + non pagato.
        </span>
      </div>

      <div className={styles.filters} role="group" aria-label="Filtri">
        {filters.map((f, i) => (
          <button
            key={f}
            type="button"
            className={i === 0 ? `${styles.filter} ${styles.filterActive}` : styles.filter}
            disabled
          >
            {f}
          </button>
        ))}
      </div>

      <Panel>
        <EmptyState
          glyph="☰"
          title="Nessun ordine da mostrare"
          description="Dopo l'import, qui compare l'elenco completo degli ordini. Il filtro predefinito è «Da ritirare»."
        />
      </Panel>
    </>
  );
}

export default Recap;
