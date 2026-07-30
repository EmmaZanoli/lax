import { useMemo } from 'react';
import type { ReconcileRow } from '../lib/import';
import styles from './Import.module.css';

interface ImportReconciliationProps {
  rows: ReconcileRow[];
}

function deltaCell(delta: number) {
  if (delta < 0) {
    return <span className={styles.deltaAmmanco}>−{Math.abs(delta)} scoperto</span>;
  }
  if (delta > 0) {
    return <span className={styles.deltaCuscinetto}>+{delta} cuscinetto</span>;
  }
  return <span className={styles.deltaEsatto}>0 esatto</span>;
}

export function ImportReconciliation({ rows }: ImportReconciliationProps) {
  const { sorted, ammanchi } = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.delta - b.delta);
    const ammanchi = rows.filter((r) => r.delta < 0).length;
    return { sorted, ammanchi };
  }, [rows]);

  return (
    <div>
      {ammanchi > 0 ? (
        <div className={styles.reconWarn}>
          <span className={styles.reconWarnCount}>{ammanchi}</span>
          <div>
            <strong>{ammanchi === 1 ? 'prodotto scoperto' : 'prodotti scoperti'}</strong>: l'ordinato
            supera la giacenza iniziale. Verifica prima di confermare — l'import resta possibile.
          </div>
        </div>
      ) : (
        <div className={`${styles.reconWarn} ${styles.reconOk}`}>
          <span className={styles.reconWarnCount}>✓</span>
          <div>
            <strong>Tutto coperto</strong>: nessun prodotto ordinato oltre la giacenza iniziale.
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.num}>N°</th>
              <th>Prodotto</th>
              <th className={styles.num}>Ordinato</th>
              <th className={styles.num}>Giacenza iniziale</th>
              <th>Scarto</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.number} className={r.delta < 0 ? styles.rowBad : ''}>
                <td className={styles.num}>{r.number}</td>
                <td className={styles.buyerName}>{r.nameSv}</td>
                <td className={styles.num}>{r.ordered}</td>
                <td className={styles.num}>{r.initialStock}</td>
                <td>{deltaCell(r.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ImportReconciliation;
