import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, stockBars, type StockBar } from '../lib';
import { Chip, EmptyState, Panel, ScreenHeader, Button } from '../components';
import { MagazzinoGiacenze } from './MagazzinoGiacenze';
import styles from './Magazzino.module.css';

const LEGEND = [
  { label: 'Ritirati', cls: styles.swatchPicked },
  { label: 'Da consegnare', cls: styles.swatchCovered },
  { label: 'Cuscinetto libero', cls: styles.swatchCushion },
  { label: 'Scoperto', cls: styles.swatchShort },
];

function statusChip(b: StockBar) {
  if (b.delta < 0) return <Chip tone="unpaid">mancano {-b.delta}</Chip>;
  if (b.delta > 0) return <Chip tone="received">coperto +{b.delta}</Chip>;
  return <Chip tone="received">coperto</Chip>;
}

function Bar({ b }: { b: StockBar }) {
  const pct = (n: number) => (b.reference > 0 ? (n / b.reference) * 100 : 0);
  return (
    <div className={styles.track} role="img" aria-label={`Barra capacità prodotto ${b.number}`}>
      {b.pickedUp > 0 && (
        <span className={`${styles.seg} ${styles.segPicked}`} style={{ width: `${pct(b.pickedUp)}%` }} />
      )}
      {b.covered > 0 && (
        <span className={`${styles.seg} ${styles.segCovered}`} style={{ width: `${pct(b.covered)}%` }} />
      )}
      {b.short > 0 && (
        <span className={`${styles.seg} ${styles.segShort}`} style={{ width: `${pct(b.short)}%` }} />
      )}
      {b.cushion > 0 && (
        <span className={`${styles.seg} ${styles.segCushion}`} style={{ width: `${pct(b.cushion)}%` }} />
      )}
    </div>
  );
}

export function Magazzino() {
  const navigate = useNavigate();
  const catalog = useStore((s) => s.catalog);
  const buyers = useStore((s) => s.buyers);
  const importedAt = useStore((s) => s.importedAt);
  const noStock = useStore((s) => s.catalog.length > 0 && s.catalog.every((p) => p.initialStock === 0));

  const [editingGiacenze, setEditingGiacenze] = useState(false);

  const bars = useMemo(() => stockBars({ catalog, buyers }), [catalog, buyers]);
  const productByNumber = useMemo(
    () => new Map(catalog.map((p) => [p.number, p])),
    [catalog],
  );

  const inStockNow = bars.reduce((s, b) => s + b.residual, 0);
  const toDeliverTotal = bars.reduce((s, b) => s + b.toDeliver, 0);
  const shortBars = bars.filter((b) => b.delta < 0);

  if (catalog.length === 0) {
    return (
      <>
        <ScreenHeader
          title="Magazzino"
          subtitle="Giacenze per prodotto: ritirato, da consegnare, cuscinetto e ammanchi."
        />
        <Panel>
          <EmptyState
            glyph="▤"
            title="Giacenze non disponibili"
            description="Carica il catalogo con le giacenze iniziali per vedere qui la capacità per prodotto."
          >
            <Button variant="secondary" onClick={() => navigate('/import')}>
              Vai all'Import
            </Button>
          </EmptyState>
        </Panel>
      </>
    );
  }

  if (editingGiacenze) {
    return <MagazzinoGiacenze onDone={() => setEditingGiacenze(false)} />;
  }

  return (
    <>
      <ScreenHeader
        title="Magazzino"
        subtitle="Giacenze per prodotto: ritirato, da consegnare, cuscinetto e ammanchi."
        actions={
          <Button variant="ghost" onClick={() => setEditingGiacenze(true)}>
            {noStock ? 'Imposta giacenze' : 'Modifica giacenze'}
          </Button>
        }
      />

      <div className={styles.summary}>
        <div className={styles.sumCard}>
          <span className="label">Pezzi in magazzino ora</span>
          <span className={styles.sumValue}>{inStockNow}</span>
        </div>
        <div className={styles.sumCard}>
          <span className="label">Ancora da consegnare</span>
          <span className={styles.sumValue}>{toDeliverTotal}</span>
        </div>
        <div className={styles.sumCard}>
          <span className="label">Prodotti scoperti</span>
          <span className={shortBars.length > 0 ? styles.sumValueAlert : styles.sumValue}>
            {shortBars.length}
          </span>
        </div>
      </div>

      {importedAt != null && noStock && (
        <div className={styles.bannerInfo}>
          <span className={styles.bannerInfoGlyph} aria-hidden="true">i</span>
          <div className={styles.bannerInfoBody}>
            <strong>Giacenze non ancora impostate</strong>
            <p>Inserisci i pezzi ricevuti per ogni prodotto quando arriva la merce.</p>
          </div>
        </div>
      )}

      {shortBars.length > 0 && (
        <div className={styles.banner}>
          <span className={styles.bannerGlyph} aria-hidden="true">
            !
          </span>
          <div>
            <strong>
              {shortBars.length === 1 ? '1 prodotto scoperto' : `${shortBars.length} prodotti scoperti`}
            </strong>
            <div className={styles.bannerList}>
              {shortBars.map((b) => {
                const p = productByNumber.get(b.number);
                return (
                  <span key={b.number} className={styles.bannerItem}>
                    {p?.nameSv ?? `#${b.number}`}
                    {p?.weight && ` · ${p.weight}`}{' '}
                    <span className={styles.bannerShort}>−{-b.delta}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className={styles.legend}>
        {LEGEND.map((l) => (
          <span key={l.label} className={styles.legendItem}>
            <span className={`${styles.swatch} ${l.cls}`} aria-hidden="true" />
            {l.label}
          </span>
        ))}
      </div>

      <div className={styles.rows}>
        {bars.map((b) => {
          const p = productByNumber.get(b.number);
          return (
            <div key={b.number} className={styles.row}>
              <div className={styles.ident}>
                <span className={styles.identName}>
                  {p?.nameSv ?? `#${b.number}`}
                  {p?.weight && <span className={styles.identWeight}> · {p.weight}</span>}
                  <span className={styles.identNum}>#{b.number}</span>
                </span>
                <span className={styles.identDesc}>
                  Iniziale {b.initialStock} · Ordinati {b.ordered}
                </span>
              </div>

              <div className={styles.barCol}>
                <Bar b={b} />
              </div>

              <div className={styles.right}>
                <span className={b.residual < 0 ? styles.residualNeg : styles.residualNum}>
                  {b.residual}
                </span>
                {statusChip(b)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default Magazzino;
