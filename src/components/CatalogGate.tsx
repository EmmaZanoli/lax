import { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useStore, parseCatalog } from '../lib';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Panel } from './Panel';
import { useToast } from './Toast';

export function CatalogGate() {
  const hydrated = useStore((s) => s.hydrated);
  const catalogLen = useStore((s) => s.catalog.length);
  const loadCatalog = useStore((s) => s.loadCatalog);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!hydrated || catalogLen > 0) return <Outlet />;

  const onFile = async (file: File) => {
    try {
      const products = parseCatalog(JSON.parse(await file.text()));
      if (products.length === 0) throw new Error('Nessun prodotto trovato nel file.');
      loadCatalog(products);
      toast.show(`Catalogo caricato: ${products.length} prodotti`, 'brass');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'File catalogo non valido.', 'unpaid');
    }
  };

  return (
    <Panel>
      <EmptyState
        glyph="❧"
        title="Carica il catalogo per iniziare"
        description="Il catalogo non è ancora presente in questo browser. Carica il file catalog.json per abilitare tutte le funzioni — verrà salvato localmente e non servirà ricaricarlo."
      >
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
        <Button variant="primary" onClick={() => fileRef.current?.click()}>
          Carica catalogo…
        </Button>
      </EmptyState>
    </Panel>
  );
}

export default CatalogGate;
