import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Buyer, Product } from '../lib';
import { useStore, downloadBackup, formatDateTime } from '../lib';
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

  const [pending, setPending] = useState<BackupFile | null>(null);

  const handleExport = () => {
    downloadBackup(useStore.getState());
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

    setPending(parsed);
  };

  const handleConfirm = () => {
    if (!pending) return;

    // Normalizza invariante: payment !== 'none' ⇒ pickedUp = true
    const buyers: Buyer[] = pending.buyers.map((b) =>
      b.payment !== 'none' ? { ...b, pickedUp: true } : b,
    );

    _replaceAll({ catalog: pending.catalog, buyers, importedAt: pending.savedAt });

    const data = formatDateTime(pending.savedAt);
    toast.show(
      `Ripristinati ${buyers.length} ordini e ${pending.catalog.length} prodotti dal backup del ${data}`,
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
      </div>

      {pending && (
        <ConfirmDialog
          title="Ripristina backup"
          confirmLabel="Ripristina"
          armedLabel="Sì, sostituisci tutto"
          onConfirm={handleConfirm}
          onClose={() => setPending(null)}
        >
          Verranno sostituiti <strong>tutti i dati attuali</strong> con il backup del{' '}
          <strong>{formatDateTime(pending.savedAt)}</strong>. L'operazione non è annullabile.
          Continuare?
        </ConfirmDialog>
      )}
    </>
  );
}

export default Backup;
