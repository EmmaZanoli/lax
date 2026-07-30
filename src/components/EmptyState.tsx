import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** Glifo/segno decorativo (facoltativo). */
  glyph?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ glyph, title, description, children }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {glyph && (
        <div className={styles.glyph} aria-hidden="true">
          {glyph}
        </div>
      )}
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {children && <div className={styles.extra}>{children}</div>}
    </div>
  );
}

export default EmptyState;
