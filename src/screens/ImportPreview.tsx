import { useMemo } from 'react';
import { formatEuro } from '../lib';
import type { DraftRow } from '../lib/import';
import { Chip } from '../components';
import styles from './Import.module.css';

interface ImportPreviewProps {
  drafts: DraftRow[];
}

function issueChips(row: DraftRow) {
  if (row.issues.length === 0) {
    return <Chip tone="received">ok</Chip>;
  }
  return (
    <>
      {row.issues.map((iss, i) =>
        iss.type === 'name-missing' ? (
          <Chip key={i} tone="unpaid">
            Nome mancante
          </Chip>
        ) : (
          <Chip key={i} tone="unpaid">
            Quantità «{iss.value}» in {iss.column}
          </Chip>
        ),
      )}
    </>
  );
}

export function ImportPreview({ drafts }: ImportPreviewProps) {
  const stats = useMemo(() => {
    const valid = drafts.filter((d) => d.valid);
    const problem = drafts.filter((d) => d.issues.length > 0).length;
    const totalValue = valid.reduce((s, d) => s + d.total, 0);
    return { valid: valid.length, problem, totalValue };
  }, [drafts]);

  return (
    <div>
      <div className={styles.mapSummary} style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
        <Chip tone="received">{stats.valid} buyer validi</Chip>
        <Chip tone={stats.problem ? 'unpaid' : 'neutral'}>{stats.problem} righe con problemi</Chip>
        <Chip tone="brass">Totale ordini {formatEuro(stats.totalValue)}</Chip>
      </div>

      <div className={styles.tableWrap} style={{ marginTop: 'var(--space-4)' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefono</th>
              <th className={styles.num}>Pezzi</th>
              <th className={styles.num}>Totale</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id} className={d.issues.length ? styles.rowBad : ''}>
                <td className={styles.buyerName}>
                  {d.buyer.name || <span className={styles.muted}>—</span>}
                </td>
                <td className={styles.muted}>{d.buyer.phone ?? '—'}</td>
                <td className={styles.num}>{d.pieces}</td>
                <td className={styles.amount}>{formatEuro(d.total)}</td>
                <td>{issueChips(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ImportPreview;
