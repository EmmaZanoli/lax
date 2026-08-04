import { useMemo } from 'react';
import { formatEuro } from '../lib';
import type { DraftRow, RowIssue } from '../lib/import';
import { Chip } from '../components';
import styles from './Import.module.css';

interface ImportPreviewProps {
  drafts: DraftRow[];
}

/** name-missing e bad-quantity sono problemi da correggere; duplicate-name è solo un avviso. */
function isProblem(iss: RowIssue): boolean {
  return iss.type === 'name-missing' || iss.type === 'bad-quantity';
}

function issueChips(row: DraftRow) {
  if (row.issues.length === 0) {
    return <Chip tone="received">ok</Chip>;
  }
  return (
    <>
      {row.issues.map((iss, i) => {
        if (iss.type === 'name-missing') {
          return (
            <Chip key={i} tone="unpaid">
              Nome mancante
            </Chip>
          );
        }
        if (iss.type === 'bad-quantity') {
          return (
            <Chip key={i} tone="unpaid">
              Quantità «{iss.value}» in {iss.column}
            </Chip>
          );
        }
        // duplicate-name: avviso, non errore (possibile doppio invio, da rivedere).
        return (
          <Chip key={i} tone="pending">
            Nome duplicato ×{iss.count}
          </Chip>
        );
      })}
    </>
  );
}

export function ImportPreview({ drafts }: ImportPreviewProps) {
  const stats = useMemo(() => {
    const valid = drafts.filter((d) => d.valid);
    const problem = drafts.filter((d) => d.issues.some(isProblem)).length;
    const duplicate = drafts.filter((d) => d.issues.some((i) => i.type === 'duplicate-name')).length;
    const totalValue = valid.reduce((s, d) => s + d.total, 0);
    return { valid: valid.length, problem, duplicate, totalValue };
  }, [drafts]);

  return (
    <div>
      <div className={styles.mapSummary} style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
        <Chip tone="received">{stats.valid} buyer validi</Chip>
        <Chip tone={stats.problem ? 'unpaid' : 'neutral'}>{stats.problem} righe con problemi</Chip>
        {stats.duplicate > 0 && (
          <Chip tone="pending">{stats.duplicate} nomi duplicati da rivedere</Chip>
        )}
        <Chip tone="brass">Totale ordini {formatEuro(stats.totalValue)}</Chip>
      </div>

      <div className={styles.tableWrap} style={{ marginTop: 'var(--space-4)' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefono</th>
              <th>Email</th>
              <th className={styles.num}>Pezzi</th>
              <th className={styles.num}>Totale</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id} className={d.issues.some(isProblem) ? styles.rowBad : ''}>
                <td className={styles.buyerName}>
                  {d.buyer.name || <span className={styles.muted}>—</span>}
                </td>
                <td className={styles.muted}>{d.buyer.phone ?? '—'}</td>
                <td className={styles.muted}>{d.buyer.email ?? '—'}</td>
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
