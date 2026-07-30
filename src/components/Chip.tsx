import type { ReactNode } from 'react';
import styles from './Chip.module.css';

/** Toni semantici dei chip di stato (delineati, non pieni). */
export type ChipTone =
  | 'neutral' // da ritirare / generico
  | 'cash' // contanti
  | 'pending' // bonifico atteso
  | 'received' // bonifico ricevuto
  | 'unpaid' // non pagato / allarme
  | 'brass'; // accento

interface ChipProps {
  tone?: ChipTone;
  children: ReactNode;
}

export function Chip({ tone = 'neutral', children }: ChipProps) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

export default Chip;
