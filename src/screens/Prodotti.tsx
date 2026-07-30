import { Button, EmptyState, Panel, ScreenHeader } from '../components';

export function Prodotti() {
  return (
    <>
      <ScreenHeader
        title="Prodotti"
        subtitle="Anagrafica del catalogo: nome svedese, numero, descrizione italiana, foto e prezzo. Nessun dato di magazzino qui."
        actions={<Button variant="secondary" disabled>Nuovo prodotto</Button>}
      />

      <Panel>
        <EmptyState
          glyph="❦"
          title="Catalogo vuoto"
          description="Il catalogo vive in catalog.json e cambia di rado. Il numero di prodotto è la chiave stabile per l'aggancio con gli ordini."
        />
      </Panel>
    </>
  );
}

export default Prodotti;
