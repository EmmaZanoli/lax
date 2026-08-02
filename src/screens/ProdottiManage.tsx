import { useRef, useState, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Product } from '../lib';
import { useStore, parseCatalog } from '../lib';
import { Button, Panel, ScreenHeader, useToast } from '../components';
import styles from './Prodotti.module.css';

const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.currentTarget.blur();
};

/** Riga di modifica di un prodotto: stato locale, commit su blur/Invio. */
function CatalogEditRow({ product }: { product: Product }) {
  const updateProduct = useStore((s) => s.updateProduct);
  const [stock, setStock] = useState(String(product.initialStock));
  const [price, setPrice] = useState(String(product.price).replace('.', ','));
  const [desc, setDesc] = useState(product.descIt);
  const [photo, setPhoto] = useState(product.photoUrl ?? '');

  const commitStock = () => {
    const n = Math.max(0, Math.round(Number(stock.replace(',', '.')) || 0));
    updateProduct(product.number, { initialStock: n });
    setStock(String(n));
  };
  const commitPrice = () => {
    const n = Math.max(0, Number(price.replace(',', '.')) || 0);
    updateProduct(product.number, { price: n });
    setPrice(String(n).replace('.', ','));
  };
  const commitDesc = () => updateProduct(product.number, { descIt: desc.trim() });
  const commitPhoto = () =>
    updateProduct(product.number, { photoUrl: photo.trim() || undefined });

  return (
    <div className={styles.editRow}>
      <div className={styles.editIdent}>
        <span className={styles.editName}>{product.nameSv}</span>
        <span className={styles.editNum}>
          #{product.number}
          {product.weight && <span className={styles.editWeight}> · {product.weight}</span>}
        </span>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Giacenza iniziale</span>
        <input
          className={styles.inputNum}
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={commitStock}
          onKeyDown={blurOnEnter}
          aria-label={`Giacenza iniziale ${product.nameSv}`}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Prezzo €</span>
        <input
          className={styles.inputNum}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={blurOnEnter}
          aria-label={`Prezzo ${product.nameSv}`}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Descrizione</span>
        <input
          className={styles.input}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={commitDesc}
          onKeyDown={blurOnEnter}
          aria-label={`Descrizione ${product.nameSv}`}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Foto (URL)</span>
        <input
          className={styles.input}
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
          onBlur={commitPhoto}
          onKeyDown={blurOnEnter}
          placeholder="https://…"
          aria-label={`Foto ${product.nameSv}`}
        />
      </label>
    </div>
  );
}

export function ProdottiManage({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const { catalog, loadCatalog } = useStore(
    useShallow((s) => ({ catalog: s.catalog, loadCatalog: s.loadCatalog })),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    try {
      const products = parseCatalog(JSON.parse(await file.text()));
      loadCatalog(products);
      toast.show(`Catalogo caricato: ${products.length} prodotti`, 'brass');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'File catalogo non valido.', 'unpaid');
    }
  };

  return (
    <>
      <ScreenHeader
        title="Gestione catalogo"
        subtitle="Sostituisci il file, imposta le giacenze iniziali e aggiorna prezzo, descrizione e foto."
        actions={
          <Button variant="secondary" onClick={onDone}>
            Fatto
          </Button>
        }
      />

      <Panel className={styles.filePanel}>
        <div>
          <h3 className={styles.sectionTitle}>File catalogo</h3>
          <p className={styles.hint}>
            Sostituisce l'intero catalogo con un file JSON. Al momento {catalog.length}{' '}
            {catalog.length === 1 ? 'prodotto' : 'prodotti'}.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className={styles.hiddenInput}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Carica / sostituisci…
        </Button>
      </Panel>

      {catalog.length > 0 && (
        <div className={styles.editList}>
          <div className={styles.editHead}>
            <span className="label">Prodotto</span>
            <span className="label">Giacenza iniziale</span>
            <span className="label">Prezzo €</span>
            <span className="label">Descrizione</span>
            <span className="label">Foto (URL)</span>
          </div>
          {catalog.map((p) => (
            <CatalogEditRow key={p.number} product={p} />
          ))}
        </div>
      )}
    </>
  );
}

export default ProdottiManage;
