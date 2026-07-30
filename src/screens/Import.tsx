import { Button, EmptyState, Panel, ScreenHeader } from '../components';

export function Import() {
  return (
    <>
      <ScreenHeader
        title="Import"
        subtitle="Carica il file degli ordini, mappa le colonne, verifica l'anteprima e riconcilia ordinato e giacenza."
        actions={<Button variant="primary" disabled>Carica file…</Button>}
      />

      <Panel>
        <EmptyState
          glyph="⤓"
          title="Nessun file caricato"
          description="Trascina qui il file esportato dal Google Form, oppure usa «Carica file». I prezzi restano nel catalogo: eventuali totali nel file vengono ignorati."
        />
      </Panel>
    </>
  );
}

export default Import;
