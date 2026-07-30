import type { ReactNode } from 'react';
import styles from './ScreenHeader.module.css';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Azioni contestuali, allineate a destra. */
  actions?: ReactNode;
}

export function ScreenHeader({ title, subtitle, actions }: ScreenHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

export default ScreenHeader;
