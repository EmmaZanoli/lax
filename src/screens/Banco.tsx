import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore, orderPieces, orderTotal, formatEuro, lastName, isCustomer } from '../lib';
import { Button, Chip, EmptyState, Panel, ScreenHeader, useToast } from '../components';
import { BancoBuyerCard, type SaveMode } from './BancoBuyerCard';
import styles from './Banco.module.css';

/** Confronto testuale insensibile a maiuscole e accenti. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

const TOAST_LABEL: Record<SaveMode, string> = {
  cash: 'contanti',
  pending: 'bonifico atteso',
  received: 'bonifico ricevuto',
  none: 'solo ritiro',
};

export function Banco() {
  const navigate = useNavigate();
  const toast = useToast();

  const { buyers, catalog, setPayment, setPickup } = useStore(
    useShallow((s) => ({
      buyers: s.buyers,
      catalog: s.catalog,
      setPayment: s.setPayment,
      setPickup: s.setPickup,
    })),
  );

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Solo clienti da servire: gli ordini per uso personale non passano dal Banco.
  const pending = useMemo(
    () =>
      buyers
        .filter((b) => isCustomer(b) && !b.pickedUp)
        .sort((a, b) => {
          const cmp = lastName(a.name).localeCompare(lastName(b.name), 'it');
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, 'it');
        }),
    [buyers],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return pending;
    return pending.filter(
      (b) => normalize(b.name).includes(q) || normalize(b.phone ?? '').includes(q),
    );
  }, [pending, query]);

  const selected = useMemo(
    () => (selectedId ? (pending.find((b) => b.id === selectedId) ?? null) : null),
    [pending, selectedId],
  );

  // Se il buyer selezionato esce dalla lista (salvato/annullato), torna alla ricerca.
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  // Autofocus sulla ricerca all'avvio e ogni volta che si torna alla lista.
  useEffect(() => {
    if (!selected) searchRef.current?.focus();
  }, [selected]);

  const backToSearch = () => {
    setSelectedId(null);
    setQuery('');
  };

  const handleSave = (mode: SaveMode) => {
    if (!selected) return;
    const name = selected.name;
    if (mode === 'none') setPickup(selected.id, true);
    else setPayment(selected.id, mode);
    toast.show(`${name}: ritirato · ${TOAST_LABEL[mode]}`, 'brass');
    backToSearch();
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filtered.length === 1) {
      setSelectedId(filtered[0].id);
    }
  };

  // Nessun import ancora: l'entrata operativa del Banco è l'Import.
  if (buyers.length === 0) {
    return <Navigate to="/import" replace />;
  }

  return (
    <>
      <ScreenHeader
        title="Banco"
        subtitle="Trova il buyer, mostra ordine e importo, registra ritiro e pagamento."
        actions={<Chip tone="neutral">{pending.length} da ritirare</Chip>}
      />

      {selected ? (
        <BancoBuyerCard
          key={selected.id}
          buyer={selected}
          catalog={catalog}
          onBack={backToSearch}
          onSave={handleSave}
        />
      ) : pending.length === 0 ? (
        <Panel>
          <EmptyState
            glyph="✓"
            title="Nessuno da servire"
            description="Tutti i buyer hanno ritirato. Puoi seguire i pagamenti dagli Ordini."
          >
            <Button variant="secondary" onClick={() => navigate('/recap')}>
              Vai al Recap
            </Button>
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className={styles.searchBar}>
            <span className={styles.searchGlyph} aria-hidden="true">
              ⌕
            </span>
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Cerca un buyer per nome o telefono…"
              aria-label="Cerca un buyer"
              autoComplete="off"
            />
          </div>

          {filtered.length === 0 ? (
            <Panel>
              <EmptyState
                glyph="⌕"
                title="Nessun risultato"
                description={`Nessun buyer da ritirare corrisponde a «${query}».`}
              />
            </Panel>
          ) : (
            <ul className={styles.list}>
              {filtered.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    className={styles.listRow}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <span className={styles.listMain}>
                      <span className={styles.listName}>{b.name}</span>
                      <span className={styles.listMeta}>
                        {orderPieces(b)} pezzi{b.phone ? ` · ${b.phone}` : ''}
                      </span>
                    </span>
                    <span className={styles.listTotal}>{formatEuro(orderTotal(b, catalog))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

export default Banco;
