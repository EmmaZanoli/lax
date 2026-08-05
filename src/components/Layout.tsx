import Sidebar from './Sidebar';
import { CatalogGate } from './CatalogGate';
import styles from './Layout.module.css';

export function Layout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.content}>
          <CatalogGate />
        </div>
      </main>
    </div>
  );
}

export default Layout;
