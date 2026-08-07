import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Buyer, Product, AutoSnapshot } from '../lib';
import {
  useStore,
  downloadBackup,
  formatDateTime,
  timeAgo,
  needsBackup,
  loadAutoSnapshots,
} from '../lib';
import { Button, ConfirmDialog, Panel, ScreenHeader, useToast } from '../components';
import styles from './Backup.module.css';

interface BackupFile {
  app: string;
  type: string;
  version: number;
  savedAt: string;
  catalog: Product[];
  buyers: Buyer[];
}

function parseBackupFile(raw: unknown): BackupFile {
  if (typeof raw !== 'object' || raw === null) throw new Error('not-object');
  const o = raw as Record<string, unknown>;
  if (o.app !== 'lax' || o.type !== 'backup') throw new Error('not-backup');
  if (!Array.isArray(o.catalog) || !Array.isArray(o.buyers)) throw new Error('missing-arrays');
  return o as unknown as BackupFile;
}

export function Backup() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const _replaceAll = useStore((s) => s._replaceAll);
  const markBackedUp = useStore((s) => s.markBackedUp);

  const hasData = useStore((s) => s.buyers.length > 0);
  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const stale = useStore((s) =>
    needsBackup(s.buyers.length > 0, {
      lastBackupAt: s.lastBackupAt,
      lastMutatedAt: s.lastMutatedAt,
    }),
  );

  const [pending, setPending] = useState<(BackupFile & { fromFile: boolean }) | null>(null);
  const [snapshots, setSnapshots] = useState<AutoSnapshot[]>([]);

  useEffect(() => {
    void loadAutoSnapshots().then(setSnapshots);
  }, []);

  const handleExport = () => {
    downloadBackup(useStore.getState());
    markBackedUp();
    toast.show('Backup scaricato', 'brass');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      toast.show('Questo file non sembra un backup di lax.', 'unpaid');
      return;
    }

    let parsed: BackupFile;
    try {
      parsed = parseBackupFile(raw);
    } catch {
      toast.show('Questo file non sembra un backup di lax.', 'unpaid');
      return;
    }

    if (parsed.version > 1) {
      toast.show(
        `Backup versione ${parsed.version}: potrebbe contenere dati non completamente gestiti.`,
      );
    }

    setPending({ ...parsed, fromFile: true });
  };

  // Ripristino da uno snapshot automatico: stessa conferma del file.
  const restoreSnapshot = (snap: AutoSnapshot) => {
    setPending({
      app: 'lax',
      type: 'backup',
      version: 1,
      savedAt: snap.savedAt,
      catalog: snap.catalog,
      buyers: snap.buyers,
      fromFile: false,
    });
  };

  const handleConfirm = () => {
    if (!pending) return;

    // Normalizza invariante: payment !== 'none' ⇒ pickedUp = true
    const buyers: Buyer[] = pending.buyers.map((b) =>
      b.payment !== 'none' ? { ...b, pickedUp: true } : b,
    );

    // Da FILE: i dati coincidono con un file su disco ⇒ marca il backup a quel
    // momento (niente "da salvare"). Da SNAPSHOT: nessun file esiste ⇒ segna solo
    // la mutazione, così l'indicatore invita a salvare un backup vero.
    _replaceAll({
      catalog: pending.catalog,
      buyers,
      importedAt: pending.savedAt,
      lastMutatedAt: pending.fromFile ? pending.savedAt : new Date().toISOString(),
      ...(pending.fromFile ? { lastBackupAt: pending.savedAt } : {}),
    });

    const data = formatDateTime(pending.savedAt);
    const from = pending.fromFile ? `dal backup del ${data}` : `dallo snapshot del ${data}`;
    toast.show(
      `Ripristinati ${buyers.length} ordini e ${pending.catalog.length} prodotti ${from}`,
      'brass',
    );
    setPending(null);
    void navigate('/banco');
  };

  return (
    <>
      <ScreenHeader
        title="Backup"
        subtitle="Esporta e ripristina lo stato completo dell'app."
      />

      <div className={styles.page}>
        {hasData && (
          <div className={styles.status} data-stale={stale || undefined}>
            <div className={styles.statusMain}>
              <span className="label">Ultimo backup</span>
              <span className={styles.statusWhen}>
                {lastBackupAt ? timeAgo(lastBackupAt) : 'Mai eseguito'}
              </span>
            </div>
            <p className={styles.statusNote}>
              {stale
                ? 'Ci sono modifiche non ancora salvate in un backup: esportane uno per non rischiare di perderle.'
                : 'I dati di oggi sono al sicuro in un backup.'}
            </p>
          </div>
        )}

        <div className={styles.grid}>
          <Panel className={styles.card}>
            <div className={styles.cardIcon} aria-hidden="true">↓</div>
            <h2 className={styles.cardTitle}>Esporta backup</h2>
            <p className={styles.cardDesc}>
              Salva tutti i dati (catalogo e ordini) in un file. Tienilo al sicuro: contiene nomi e
              telefoni.
            </p>
            <Button variant="primary" onClick={handleExport}>
              Esporta backup
            </Button>
          </Panel>

          <Panel className={styles.card}>
            <div className={styles.cardIcon} aria-hidden="true">↑</div>
            <h2 className={styles.cardTitle}>Ripristina backup</h2>
            <p className={styles.cardDesc}>
              Carica un file di backup per riportare l'app a quello stato. Sostituisce tutti i dati
              attuali.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              Ripristina backup…
            </Button>
          </Panel>
        </div>

        <p className={styles.tip}>
          Consiglio: esporta un backup più volte durante la giornata del ritiro.
        </p>

        {snapshots.length > 0 && (
          <Panel className={styles.snapPanel}>
            <h2 className={styles.cardTitle}>Snapshot automatici</h2>
            <p className={styles.cardDesc}>
              Copie salvate automaticamente in questo browser durante la giornata: una rete di
              sicurezza per gli errori (non sostituiscono un backup su file). Ripristinane una per
              tornare a un punto precedente.
            </p>
            <ul className={styles.snapList}>
              {[...snapshots].reverse().map((s) => (
                <li key={s.savedAt} className={styles.snapItem}>
                  <span className={styles.snapWhen}>{formatDateTime(s.savedAt)}</span>
                  <span className={styles.snapMeta}>
                    {s.buyers.length} {s.buyers.length === 1 ? 'ordine' : 'ordini'}
                  </span>
                  <Button variant="ghost" onClick={() => restoreSnapshot(s)}>
                    Ripristina
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {pending && (
        <ConfirmDialog
          title="Ripristina backup"
          confirmLabel="Ripristina"
          armedLabel="Sì, sostituisci tutto"
          onConfirm={handleConfirm}
          onClose={() => setPending(null)}
        >
          Verranno sostituiti <strong>tutti i dati attuali</strong> con{' '}
          {pending.fromFile ? 'il backup' : 'lo snapshot'} del{' '}
          <strong>{formatDateTime(pending.savedAt)}</strong>. L'operazione non è annullabile.
          Continuare?
        </ConfirmDialog>
      )}
    </>
  );
}

export default Backup;
