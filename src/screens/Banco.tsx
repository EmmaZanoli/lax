import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore, orderPieces, orderTotal, formatEuro, isCustomer } from '../lib';
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
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Solo clienti da servire: gli ordini per uso personale non passano dal Banco.
  const pending = useMemo(
    () =>
      buyers
        .filter((b) => isCustomer(b) && !b.pickedUp)
        .sort((a, b) => a.name.localeCompare(b.name, 'it')),
    [buyers],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return pending;
    return pending.filter(
      (b) => normalize(b.name).includes(q) || normalize(b.phone ?? '').includes(q),
    );
  }, [pending, query]);

  // Riga evidenziata per la navigazione da tastiera (clampata ai risultati).
  const active = filtered.length ? Math.min(activeIndex, filtered.length - 1) : -1;

  const selected = useMemo(
    () => (selectedId ? (pending.find((b) => b.id === selectedId) ?? null) : null),
    [pending, selectedId],
  );

  // Ogni nuova ricerca riparte dal primo risultato.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Tiene visibile la riga evidenziata mentre si scorre con le frecce.
  useEffect(() => {
    if (active < 0) return;
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({
      block: 'nearest',
    });
  }, [active]);

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

  // ↑/↓ scorrono i risultati, Invio apre quello evidenziato (di default il primo).
  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setSelectedId(filtered[active].id);
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
              role="combobox"
              aria-expanded={filtered.length > 0}
              aria-controls="banco-listbox"
              aria-autocomplete="list"
              aria-activedescendant={
                active >= 0 ? `banco-opt-${filtered[active].id}` : undefined
              }
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
            <ul ref={listRef} id="banco-listbox" role="listbox" className={styles.list}>
              {filtered.map((b, i) => (
                <li key={b.id}>
                  <button
                    id={`banco-opt-${b.id}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    data-active={i === active || undefined}
                    className={styles.listRow}
                    onMouseEnter={() => setActiveIndex(i)}
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
