import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import type { Buyer } from '../lib';
import {
  useStore,
  totals,
  orderTotal,
  orderPieces,
  orderedTotals,
  formatEuro,
  isBalanced,
  isPersonal,
  isCustomer,
} from '../lib';
import {
  Button,
  Chip,
  Drawer,
  EmptyState,
  Panel,
  ScreenHeader,
  type ChipTone,
} from '../components';
import { RecapOrderDrawer } from './RecapOrderDrawer';
import { RecapAddDrawer } from './RecapAddDrawer';
import styles from './Recap.module.css';

type FilterKey =
  | 'to-pick'
  | 'to-pay'
  | 'cash'
  | 'pending'
  | 'received'
  | 'ritirati'
  | 'personal'
  | 'all';

// I filtri clienti escludono sempre gli ordini per uso personale.
const PREDS: Record<FilterKey, (b: Buyer) => boolean> = {
  'to-pick': (b) => isCustomer(b) && !b.pickedUp,
  'to-pay': (b) => isCustomer(b) && b.pickedUp && b.payment === 'none',
  cash: (b) => isCustomer(b) && b.pickedUp && b.payment === 'cash',
  pending: (b) => isCustomer(b) && b.pickedUp && b.payment === 'pending',
  received: (b) => isCustomer(b) && b.pickedUp && b.payment === 'received',
  ritirati: (b) => isCustomer(b) && b.pickedUp,
  personal: (b) => isPersonal(b),
  all: () => true,
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'to-pick', label: 'Da ritirare' },
  { key: 'to-pay', label: 'Da pagare' },
  { key: 'cash', label: 'Contanti' },
  { key: 'pending', label: 'Bonifico atteso' },
  { key: 'received', label: 'Bonifico ricevuto' },
  { key: 'ritirati', label: 'Ritirati' },
  { key: 'personal', label: 'Uso personale' },
  { key: 'all', label: 'Tutti' },
];

function statusChip(b: Buyer) {
  if (isPersonal(b)) return <Chip tone="personal">Uso personale</Chip>;
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

  const { buyers, catalog } = useStore(
    useShallow((s) => ({ buyers: s.buyers, catalog: s.catalog })),
  );

  const [filter, setFilter] = useState<FilterKey>('to-pick');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reconOpen, setReconOpen] = useState(false);
  const lastIdRef = useRef<string | null>(null);
  if (selectedId) lastIdRef.current = selectedId;

  const t = useMemo(() => totals({ catalog, buyers }), [catalog, buyers]);
  const balanced = useMemo(() => isBalanced({ catalog, buyers }), [catalog, buyers]);

  // Ordinato totale incluso l'uso personale — solo per riconciliare la fattura fornitore.
  const ordered = useMemo(() => orderedTotals({ catalog, buyers }), [catalog, buyers]);
  const productByNumber = useMemo(
    () => new Map(catalog.map((p) => [p.number, p])),
    [catalog],
  );

  const counts = useMemo(() => {
    const c = {} as Record<FilterKey, number>;
    for (const f of FILTERS) c[f.key] = buyers.filter(PREDS[f.key]).length;
    return c;
  }, [buyers]);

  const rows = useMemo(() => {
    const list = buyers.filter(PREDS[filter]);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [buyers, filter]);

  const cards: { key: FilterKey; label: string; value: number; count: number; tone: ChipTone }[] = [
    { key: 'cash', label: 'Contanti in cassa', value: t.cash, count: counts.cash, tone: 'cash' },
    { key: 'received', label: 'Bonifici ricevuti', value: t.received, count: counts.received, tone: 'received' },
    { key: 'pending', label: 'Bonifici attesi', value: t.pending, count: counts.pending, tone: 'pending' },
    { key: 'to-pay', label: 'Ritirato non pagato', value: t.unpaid, count: counts['to-pay'], tone: 'unpaid' },
    { key: 'to-pick', label: 'Devono ritirare', value: t.toPickValue, count: t.toPickCount, tone: 'unpaid' },
  ];

  return (
    <>
      <ScreenHeader
        title="Ordini"
        subtitle="Tutti gli ordini, con la quadratura del denaro e l'export di fine giornata."
        actions={
          <>
            <Chip tone={balanced ? 'received' : 'unpaid'}>
              {balanced ? 'I conti quadrano' : 'Conti da verificare'}
            </Chip>
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              Aggiungi ordine
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

          {/* Voci fuori dai conti dei clienti: uso personale + riconciliazione fattura. */}
          <div className={styles.recon}>
            <button
              type="button"
              className={styles.reconItem}
              data-tone="personal"
              data-active={filter === 'personal'}
              onClick={() => setFilter('personal')}
            >
              <span className="label">Valore uso personale</span>
              <span className={styles.reconValue}>{formatEuro(t.personal)}</span>
              <span className={styles.reconCount}>
                {t.personalCount} {t.personalCount === 1 ? 'ordine' : 'ordini'}
              </span>
            </button>
            <div className={styles.reconItem} data-static="true">
              <span className="label">Totale ordinato · clienti + personale</span>
              <span className={styles.reconValue}>{formatEuro(t.orderedTotal)}</span>
              <span className={styles.reconCount}>per riconciliare la fattura</span>
            </div>
          </div>

          {/* Dettaglio per prodotto dell'ordinato TOTALE (incluso uso personale).
              Solo per riconciliare la fattura del fornitore: non è un dato di magazzino. */}
          <div className={styles.reconDetail}>
            <button
              type="button"
              className={styles.reconDetailToggle}
              onClick={() => setReconOpen((v) => !v)}
              aria-expanded={reconOpen}
            >
              <span className={styles.reconChevron} aria-hidden="true">
                {reconOpen ? '▾' : '▸'}
              </span>
              Ordinato totale per prodotto · incluso uso personale
              <span className={styles.reconDetailMeta}>
                {ordered.totalPieces} pezzi · {formatEuro(ordered.totalValue)}
              </span>
            </button>

            {reconOpen && (
              <div className={styles.reconTableWrap}>
                <p className={styles.reconDetailNote}>
                  Include i pezzi per uso personale ({ordered.personalPieces}), che il fornitore
                  fattura ma che <strong>non</strong> entrano nella giacenza del Magazzino
                  (solo clienti). Dato a fini di riconciliazione: non incide su residuo, ammanchi
                  o cassa.
                </p>
                {ordered.rows.length === 0 ? (
                  <p className={styles.reconEmpty}>Nessun prodotto ordinato.</p>
                ) : (
                  <table className={styles.reconTable}>
                    <thead>
                      <tr>
                        <th scope="col">Prodotto</th>
                        <th scope="col" className={styles.reconNumCol}>
                          Clienti
                        </th>
                        <th scope="col" className={styles.reconNumCol}>
                          Personale
                        </th>
                        <th scope="col" className={styles.reconNumCol}>
                          Totale
                        </th>
                        <th scope="col" className={styles.reconNumCol}>
                          Valore
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordered.rows.map((r) => {
                        const p = productByNumber.get(r.number);
                        return (
                          <tr key={r.number}>
                            <td>
                              <span className={styles.reconName}>
                                {p?.nameSv ?? `#${r.number}`}
                                {p?.weight && (
                                  <span className={styles.reconWeight}> · {p.weight}</span>
                                )}
                                <span className={styles.reconHash}>#{r.number}</span>
                              </span>
                            </td>
                            <td className={styles.reconNumCol}>{r.customer}</td>
                            <td className={styles.reconNumCol} data-personal={r.personal > 0}>
                              {r.personal || '—'}
                            </td>
                            <td className={`${styles.reconNumCol} ${styles.reconTotalCol}`}>
                              {r.total}
                            </td>
                            <td className={styles.reconNumCol}>{formatEuro(r.value)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Totale</th>
                        <td className={styles.reconNumCol}>
                          {ordered.totalPieces - ordered.personalPieces}
                        </td>
                        <td className={styles.reconNumCol}>{ordered.personalPieces || '—'}</td>
                        <td className={`${styles.reconNumCol} ${styles.reconTotalCol}`}>
                          {ordered.totalPieces}
                        </td>
                        <td className={styles.reconNumCol}>{formatEuro(ordered.totalValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}
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
                      data-kind={b.kind}
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

      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Nuovo ordine manuale">
        {addOpen && <RecapAddDrawer onClose={() => setAddOpen(false)} />}
      </Drawer>
    </>
  );
}

export default Recap;
