import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../lib';
import {
  buildDrafts,
  buildInitialMapping,
  loadSavedMapping,
  parseFile,
  reconcile,
  saveMapping,
  signature,
  type Mapping,
  type ParsedTable,
} from '../lib/import';
import { Button, Panel, ScreenHeader, useToast } from '../components';
import { ImportDropZone } from './ImportDropZone';
import { ImportColumnMapper } from './ImportColumnMapper';
import { ImportPreview } from './ImportPreview';
import { ImportReconciliation } from './ImportReconciliation';
import styles from './Import.module.css';

type Step = 'upload' | 'map' | 'preview' | 'reconcile';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Carica' },
  { key: 'map', label: 'Mappa colonne' },
  { key: 'preview', label: 'Anteprima' },
  { key: 'reconcile', label: 'Magazzino' },
];

function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <div className={styles.stepper}>
      {STEPS.map((s, i) => {
        const cls =
          i === currentIndex ? styles.stepActive : i < currentIndex ? styles.stepDone : '';
        return (
          <div key={s.key} style={{ display: 'contents' }}>
            <div className={`${styles.step} ${cls}`}>
              <span className={styles.stepNum}>{i < currentIndex ? '✓' : i + 1}</span>
              <span className={styles.stepLabel}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={styles.stepSep} />}
          </div>
        );
      })}
    </div>
  );
}

export function Import() {
  const navigate = useNavigate();
  const toast = useToast();

  const { catalog, importData } = useStore(
    useShallow((s) => ({ catalog: s.catalog, importData: s.importData })),
  );

  const [step, setStep] = useState<Step>('upload');
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Mapping>([]);
  const [busy, setBusy] = useState(false);

  const drafts = useMemo(
    () => (table ? buildDrafts(table, mapping, catalog) : []),
    [table, mapping, catalog],
  );
  const recon = useMemo(() => reconcile(drafts, catalog), [drafts, catalog]);

  const validCount = drafts.filter((d) => d.valid).length;
  const problemCount = drafts.filter((d) => d.issues.length > 0).length;
  const hasName = mapping.some((r) => r.kind === 'name');
  const productNumbers = mapping.flatMap((r) => (r.kind === 'product' ? [r.number] : []));
  const duplicated = productNumbers.length !== new Set(productNumbers).size;
  const canProceedMap = hasName && productNumbers.length > 0 && !duplicated;

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const parsed = await parseFile(file);
      const saved = await loadSavedMapping(signature(parsed.columns));
      setTable(parsed);
      setMapping(buildInitialMapping(parsed.columns, catalog, saved));
      setStep('map');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Impossibile leggere il file.', 'unpaid');
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setTable(null);
    setMapping([]);
    setStep('upload');
  };

  const goPreview = () => {
    if (table) void saveMapping(signature(table.columns), table.columns, mapping);
    setStep('preview');
  };

  const confirm = () => {
    const buyers = drafts.filter((d) => d.valid).map((d) => d.buyer);
    importData(buyers);
    toast.show(`Import completato: ${buyers.length} buyer`, 'brass');
    navigate('/banco');
  };

  const catalogEmpty = catalog.length === 0;

  return (
    <>
      <ScreenHeader
        title="Import"
        subtitle="Carica il file degli ordini, mappa le colonne, verifica l'anteprima e riconcilia con la giacenza."
        actions={
          table && (
            <Button variant="ghost" onClick={restart}>
              Ricomincia
            </Button>
          )
        }
      />

      {table && <Stepper current={step} />}

      {catalogEmpty && step !== 'upload' && (
        <div className={styles.notice}>
          <span className={styles.noticeGlyph} aria-hidden="true">
            !
          </span>
          <div>
            Nessun prodotto in catalogo: gli ordini risulterebbero senza righe. Carica prima il
            catalogo dalla schermata <strong>Prodotti</strong>.
          </div>
        </div>
      )}

      {step === 'upload' && (
        <ImportDropZone onFile={handleFile} busy={busy} />
      )}

      {step === 'map' && table && (
        <Panel>
          <ImportColumnMapper
            table={table}
            mapping={mapping}
            catalog={catalog}
            onChange={setMapping}
          />
          <div className={styles.footer}>
            <span className={styles.footerInfo}>
              {!hasName
                ? 'Indica quale colonna contiene il nome del buyer.'
                : productNumbers.length === 0
                  ? 'Aggancia almeno una colonna a un prodotto.'
                  : duplicated
                    ? 'Un prodotto è mappato su più colonne.'
                    : `${table.rows.length} righe rilevate.`}
            </span>
            <div className={styles.footerActions}>
              <Button variant="primary" onClick={goPreview} disabled={!canProceedMap}>
                Continua
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {step === 'preview' && (
        <Panel>
          <h2 className={styles.sectionTitle}>Anteprima degli ordini</h2>
          <ImportPreview drafts={drafts} />
          <div className={styles.footer}>
            <span className={styles.footerInfo}>
              {validCount} buyer verranno importati
              {problemCount > 0 && ` · ${problemCount} righe con problemi`}
              {validCount < drafts.length &&
                ` · ${drafts.length - validCount} righe senza nome escluse`}
            </span>
            <div className={styles.footerActions}>
              <Button variant="secondary" onClick={() => setStep('map')}>
                Indietro
              </Button>
              <Button variant="primary" onClick={() => setStep('reconcile')} disabled={validCount === 0}>
                Continua
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {step === 'reconcile' && (
        <Panel>
          <h2 className={styles.sectionTitle}>Riconciliazione col magazzino</h2>
          <ImportReconciliation rows={recon} />
          <div className={styles.footer}>
            <span className={styles.footerInfo}>
              {validCount} buyer · {recon.filter((r) => r.delta < 0).length} prodotti scoperti
            </span>
            <div className={styles.footerActions}>
              <Button variant="secondary" onClick={() => setStep('preview')}>
                Indietro
              </Button>
              <Button variant="primary" onClick={confirm} disabled={validCount === 0}>
                Conferma import
              </Button>
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}

export default Import;
