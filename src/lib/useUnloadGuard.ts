import { useEffect } from 'react';
import { useStore } from './store';

/**
 * Avvisa prima di chiudere/ricaricare la pagina se ci sono dati caricati.
 * Rete di sicurezza contro chiusure accidentali durante la giornata di ritiro.
 */
export function useUnloadGuard() {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // Avvisa solo se c'è lavoro della giornata (buyer importati): il catalogo
      // da solo, ricaricabile dal file, non giustifica un avviso.
      if (useStore.getState().buyers.length > 0) {
        e.preventDefault();
        // Richiesto da alcuni browser per mostrare il prompt.
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}
