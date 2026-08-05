import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdateBanner.module.css';

/**
 * Mostra un banner non invasivo quando un nuovo service worker è in waiting.
 * "Ricarica" attiva il nuovo SW e ricarica la pagina; i dati in IndexedDB
 * sono preservati (il SW non li tocca mai).
 * "×" permette di rimandare l'aggiornamento senza perdere il banner al prossimo avvio.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      if (!registration) return;
      // Controlla aggiornamenti ogni 10 minuti mentre l'app è aperta
      setInterval(() => void registration.update(), 10 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.message}>È disponibile una nuova versione.</span>
      <button className={styles.reload} onClick={() => void updateServiceWorker(true)}>
        Ricarica
      </button>
      <button className={styles.dismiss} onClick={() => setNeedRefresh(false)} aria-label="Ignora aggiornamento">
        ×
      </button>
    </div>
  );
}

export default UpdateBanner;
