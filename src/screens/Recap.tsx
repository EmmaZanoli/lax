import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import type { Buyer } from '../lib';
import {
  useStore,
  totals,
  orderTotal,
  orderPieces,
  formatEuro,
  isBalanced,
  downloadRecap,
  downloadBackup,
} from '../lib';
import {
  Button,
  Chip,
  Drawer,
  EmptyState,
  Panel,
  ScreenHeader,
  useToast,
  type ChipTone,
} from '../components';
import { RecapOrderDrawer } from './RecapOrderDrawer';
import styles from './Recap.module.css';

type FilterKey = 'to-pick' | 'to-pay' | 'cash' | 'pending' | 'received' | 'ritirati' | 'all';

const PREDS: Record<FilterKey, (b: Buyer) => boolean> = {
  'to-pick': (b) => !b.pickedUp,
  'to-pay': (b) => b.pickedUp && b.payment === 'none',
  cash: (b) => b.pickedUp && b.payment === 'cash',
  pending: (b) => b.pickedUp && b.payment === 'pending',
  received: (b) => b.pickedUp && b.payment === 'received',
  ritirati: (b) => b.pickedUp,
  all: () => true,
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'to-pick', label: 'Da ritirare' },
  { key: 'to-pay', label: 'Da pagare' },
  { key: 'cash', label: 'Contanti' },
  { key: 'pending', label: 'Bonifico atteso' },
  { key: 'received', label: 'Bonifico ricevuto' },
  { key: 'ritirati', label: 'Ritirati' },
  { key: 'all', label: 'Tutti' },
];

function statusChip(b: Buyer) {
  if (!b.pickedUp) return <Chip tone="unpaid">Da ritirare</Chip>;
  switch (b.payment) {
    case 'cash':
      return <Chip tone="cash">Contanti</Chip>;
    case 'pending':
      return <Chip tone="pending">Bonifico atteso</Chip>;
    case 'received':
      return <Chip tone="received">Bonifico ricevuto</Chip>;
    default:
      return <Chip tone="unpaid">Non pagato</Chip>;
  }
}

export function Recap() {
  const navigate = useNavigate();
  const toast = useToast();

  const { buyers, catalog } = useStore(
    useShallow((s) => ({ buyers: s.buyers, catalog: s.catalog })),
  );

  const [filter, setFilter] = useState<FilterKey>('to-pick');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastIdRef = useRef<string | null>(null);
  if (selectedId) lastIdRef.current = selectedId;

  const t = useMemo(() => totals({ catalog, buyers }), [catalog, buyers]);
  const balanced = useMemo(() => isBalanced({ catalog, buyers }), [catalog, buyers]);

  const counts = useMemo(() => {
    const c = {} as Record<FilterKey, number>;
    for (const f of FILTERS) c[f.key] = buyers.filter(PREDS[f.key]).length;
    return c;
  }, [buyers]);

  const rows = useMemo(() => {
    const list = buyers.filter(PREDS[filter]);
    // Chi non ha ritirato compare comunque per primo, poi per nome.
    return list.sort(
      (a, b) => Number(a.pickedUp) - Number(b.pickedUp) || a.name.localeCompare(b.name, 'it'),
    );
  }, [buyers, filter]);

  const cards: { key: FilterKey; label: string; value: number; count: number; tone: ChipTone }[] = [
    { key: 'cash', label: 'Contanti in cassa', value: t.cash, count: counts.cash, tone: 'cash' },
    { key: 'received', label: 'Bonifici ricevuti', value: t.received, count: counts.received, tone: 'received' },
    { key: 'pending', label: 'Bonifici attesi', value: t.pending, count: counts.pending, tone: 'pending' },
    { key: 'to-pay', label: 'Ritirato non pagato', value: t.unpaid, count: counts['to-pay'], tone: 'unpaid' },
    { key: 'to-pick', label: 'Devono ritirare', value: t.toPickValue, count: t.toPickCount, tone: 'unpaid' },
  ];

  const onExport = () => {
    downloadRecap(useStore.getState());
    toast.show('Recap esportato', 'brass');
  };
  const onBackup = () => {
    downloadBackup(useStore.getState());
    toast.show('Backup scaricato', 'brass');
  };

  return (
    <>
      <ScreenHeader
        title="Recap ordini"
        subtitle="Tutti gli ordini, con la quadratura del denaro e l'export di fine giornata."
        actions={
          <>
            <Chip tone={balanced ? 'received' : 'unpaid'}>
              {balanced ? 'I conti quadrano' : 'Conti da verificare'}
            </Chip>
            <Button variant="secondary" onClick={onExport} disabled={buyers.length === 0}>
              Esporta recap
            </Button>
            <Button variant="secondary" onClick={onBackup}>
              Backup
            </Button>
          </>
        }
      />

      {buyers.length === 0 ? (
        <Panel>
          <EmptyState
            glyph="☰"
            title="Nessun ordine caricato"
            description="Dopo l'import qui trovi l'elenco completo con la quadratura e l'export."
          >
            <Button variant="primary" onClick={() => navigate('/import')}>
              Vai all'Import
            </Button>
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className={styles.cards}>
            {cards.map((c) => (
              <button
                key={c.key}
                type="button"
                className={styles.card}
                data-tone={c.tone}
                data-active={filter === c.key}
                onClick={() => setFilter(c.key)}
              >
                <span className="label">{c.label}</span>
                <span className={styles.cardValue}>{formatEuro(c.value)}</span>
                <span className={styles.cardCount}>
                  {c.count} {c.count === 1 ? 'ordine' : 'ordini'}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.filters} role="group" aria-label="Filtri">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={styles.filter}
                data-active={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className={styles.filterCount}>{counts[f.key]}</span>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <Panel>
              <EmptyState glyph="—" title="Nessun ordine in questo filtro" />
            </Panel>
          ) : (
            <ul className={styles.list}>
              {rows.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <span
                      className={styles.dot}
                      data-picked={b.pickedUp}
                      aria-hidden="true"
                    />
                    <span className={styles.rowName}>{b.name}</span>
                    <span className={styles.rowPieces}>{orderPieces(b)} pezzi</span>
                    <span className={styles.rowChip}>{statusChip(b)}</span>
                    <span className={styles.rowTotal}>{formatEuro(orderTotal(b, catalog))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Drawer open={!!selectedId} onClose={() => setSelectedId(null)} title="Ordine">
        {lastIdRef.current && <RecapOrderDrawer id={lastIdRef.current} />}
      </Drawer>
    </>
  );
}

export default Recap;
