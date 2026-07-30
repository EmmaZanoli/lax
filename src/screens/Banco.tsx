import { Button, Chip, EmptyState, Panel, ScreenHeader } from '../components';
import styles from './Banco.module.css';

export function Banco() {
  return (
    <>
      <ScreenHeader
        title="Banco"
        subtitle="Trova il buyer, mostra ordine e importo, registra ritiro e pagamento."
        actions={<Chip tone="neutral">0 da ritirare</Chip>}
      />

      <div className={styles.searchbar}>
        <span className={styles.searchGlyph} aria-hidden="true">
          ⌕
        </span>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Cerca un buyer per nome o telefono…"
          aria-label="Cerca un buyer"
          disabled
        />
      </div>

      <Panel>
        <EmptyState
          glyph="✳"
          title="Nessun ordine caricato"
          description="Importa il file degli ordini per iniziare a servire il banco. Qui comparirà solo chi non ha ancora ritirato."
        >
          <Button variant="primary" disabled>
            Vai all'Import
          </Button>
        </EmptyState>
      </Panel>
    </>
  );
}

export default Banco;
