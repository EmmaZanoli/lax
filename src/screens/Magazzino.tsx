import { EmptyState, Panel, ScreenHeader } from '../components';

export function Magazzino() {
  return (
    <>
      <ScreenHeader
        title="Magazzino"
        subtitle="Giacenze per prodotto: quanto è stato ritirato, quanto resta da consegnare, il cuscinetto e gli eventuali ammanchi."
      />

      <Panel>
        <EmptyState
          glyph="▤"
          title="Giacenze non disponibili"
          description="Compila la giacenza iniziale quando arriva la merce. La residua si scala sul ritiro, mai sul pagamento."
        />
      </Panel>
    </>
  );
}

export default Magazzino;
