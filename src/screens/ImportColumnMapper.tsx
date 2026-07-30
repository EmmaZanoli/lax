import { useMemo } from 'react';
import type { Product } from '../lib';
import type { ColumnRole, Mapping, ParsedTable } from '../lib/import';
import { Chip } from '../components';
import styles from './Import.module.css';

interface ImportColumnMapperProps {
  table: ParsedTable;
  mapping: Mapping;
  catalog: Product[];
  onChange: (mapping: Mapping) => void;
}

function roleToValue(r: ColumnRole): string {
  return r.kind === 'product' ? `product:${r.number}` : r.kind;
}

function valueToRole(v: string): ColumnRole {
  if (v === 'name' || v === 'phone' || v === 'ignore') return { kind: v };
  if (v.startsWith('product:')) return { kind: 'product', number: Number(v.slice('product:'.length)) };
  return { kind: 'ignore' };
}

/** Primi valori non vuoti di una colonna, per aiutare il riconoscimento. */
function samplesOf(table: ParsedTable, colIdx: number, max = 3): string[] {
  const out: string[] = [];
  for (const row of table.rows) {
    const v = (row[colIdx] ?? '').trim();
    if (v) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function ImportColumnMapper({ table, mapping, catalog, onChange }: ImportColumnMapperProps) {
  const setRole = (idx: number, role: ColumnRole) => {
    const next = mapping.slice();
    next[idx] = role;
    onChange(next);
  };

  const summary = useMemo(() => {
    const nameCols = mapping.filter((r) => r.kind === 'name').length;
    const phoneCols = mapping.filter((r) => r.kind === 'phone').length;
    const productNumbers = mapping.flatMap((r) => (r.kind === 'product' ? [r.number] : []));
    const duplicated = productNumbers.length !== new Set(productNumbers).size;
    return { nameCols, phoneCols, productCount: productNumbers.length, duplicated };
  }, [mapping]);

  return (
    <div>
      <p className={styles.mapIntro}>
        Indica il ruolo di ogni colonna. I prodotti vengono agganciati al catalogo (per numero o
        nome svedese); i prezzi restano quelli di catalogo, non quelli del file.
      </p>

      <div className={styles.mapGrid}>
        {table.columns.map((col, idx) => {
          const role = mapping[idx] ?? { kind: 'ignore' };
          const samples = samplesOf(table, idx);
          const isProduct = role.kind === 'product';
          return (
            <div
              key={idx}
              className={`${styles.mapRow} ${isProduct ? styles.mapRowProduct : ''}`}
            >
              <div
                className={`${styles.mapColName} ${col ? '' : styles.mapColNameBlank}`}
                title={col || `Colonna ${idx + 1}`}
              >
                {col || `Colonna ${idx + 1}`}
              </div>
              <div className={styles.mapSamples}>
                {samples.length ? samples.join(' · ') : '—'}
              </div>
              <select
                className={styles.select}
                value={roleToValue(role)}
                onChange={(e) => setRole(idx, valueToRole(e.target.value))}
                aria-label={`Ruolo della colonna ${col || idx + 1}`}
              >
                <option value="ignore">Ignora</option>
                <option value="name">Nome buyer</option>
                <option value="phone">Telefono</option>
                <optgroup label="Prodotto">
                  {catalog.map((p) => (
                    <option key={p.number} value={`product:${p.number}`}>
                      {p.number} · {p.nameSv}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          );
        })}
      </div>

      <div className={styles.mapSummary}>
        <Chip tone={summary.nameCols === 1 ? 'received' : 'unpaid'}>
          {summary.nameCols === 1 ? 'Nome: 1 colonna' : `Nome: ${summary.nameCols} colonne`}
        </Chip>
        <Chip tone="neutral">
          {summary.phoneCols ? `Telefono: ${summary.phoneCols}` : 'Telefono: nessuno'}
        </Chip>
        <Chip tone={summary.productCount ? 'brass' : 'unpaid'}>
          {summary.productCount} prodotti mappati
        </Chip>
        {summary.duplicated && <Chip tone="unpaid">Prodotto mappato più volte</Chip>}
      </div>
    </div>
  );
}

export default ImportColumnMapper;
