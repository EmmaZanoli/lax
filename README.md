# lax

App per gestire la **giornata di ritiro** (una volta all'anno) di prodotti alimentari svedesi.

Un *seller* ha raccolto ordini via Google Form; i *buyer* vengono di persona, ritirano e pagano. Da solo, il seller trova il buyer, mostra ordine e importo, registra ritiro e pagamento e tiene d'occhio il magazzino. Nei giorni successivi spunta i bonifici che arrivano.

È uno strumento **solo frontend**, da browser su computer, pensato per **una persona su un dispositivo**. L'interfaccia è in **italiano**; i nomi dei prodotti restano in **svedese**.

---

## Deploy su GitHub Pages

**App live:** https://emmzanoli.github.io/lax/

Il deploy avviene **automaticamente a ogni push su `main`** tramite GitHub Actions
(workflow in `.github/workflows/deploy.yml`).

### Primo setup (una volta sola)

1. Vai su **Settings → Pages** del repository su GitHub
2. Sotto **Source**, seleziona **GitHub Actions**
3. Salva

Da quel momento ogni push su `main` ricostruisce e pubblica l'app.
Puoi anche avviare un deploy manuale dalla tab **Actions → Deploy to GitHub Pages → Run workflow**.

### Dati e privacy (repo pubblico)

**Sul repository e sul sito pubblicato non finiscono mai dati personali.**
I dati importati (nomi, telefoni, email dei buyer, ordini) vivono esclusivamente
in IndexedDB nel browser di chi usa l'app e non lasciano mai il dispositivo.

Il `.gitignore` esclude esplicitamente `ordine.xlsx`, `public/catalog.json`,
`lax-backup*.json` e qualsiasi CSV — solo il codice è pubblico.

---

## Caratteristiche

- **Nessun backend, nessun login.** Tutto vive nel browser.
- **Offline (PWA).** Una volta caricata, l'app funziona senza rete durante la giornata: service worker con precache di codice, stili, font (self-hosted) e catalogo.
- **Persistenza a prova di refresh.** Lo stato è salvato su **IndexedDB** a ogni azione e ricaricato all'avvio; una guardia avvisa prima di chiudere se ci sono ordini caricati.
- **Import flessibile** da CSV/XLSX con mappatura colonne che regge le variazioni del Google Form di anno in anno.
- **Annulla a un livello** sempre disponibile e toast di conferma su ogni azione.

## Regole di dominio (invarianti)

- Ordini **immutabili**: al ritiro si cambia solo lo *stato*, mai il contenuto. Nessun cliente fuori lista.
- Il **ritiro è sempre totale**, mai parziale.
- Due stati indipendenti per buyer: `pickedUp` (bool) e `payment` ∈ `none | cash | pending | received`, con l'invariante **`payment ≠ none ⇒ pickedUp = true`**.
- I **prezzi vivono solo nel catalogo**: il totale si ricalcola sempre come Σ(quantità × prezzo). Eventuali totali nel file d'import sono ignorati.
- La **giacenza la scala il ritiro**, non il pagamento: `residuo = giacenza iniziale − pezzi ritirati`.
- Il **numero di prodotto** è la chiave stabile per l'aggancio catalogo ↔ CSV.

---

## Stack

- **Vite + React + TypeScript**
- **Zustand** con middleware `persist` su **IndexedDB** (storage custom via `idb-keyval`)
- **react-router-dom** (rotta di default `/banco`)
- **papaparse** (CSV) ed **ExcelJS** (Excel) per import ed export del recap
- Font **self-hosted**: `@fontsource-variable/fraunces` e `@fontsource/inter`
- **vite-plugin-pwa** (Workbox) per l'uso offline

## Requisiti

- Node.js 20+ (sviluppato con Node 22) e npm.

## Comandi

```bash
npm install       # installa le dipendenze
npm run dev       # avvia l'ambiente di sviluppo (apre il browser)
npm run build     # type-check + build di produzione in dist/
npm run preview   # serve la build (utile per provare l'offline/PWA)
npm run typecheck # solo controllo dei tipi
```

Per provare il funzionamento offline: `npm run build && npm run preview`, apri l'app, poi disattiva la rete e ricarica.

> In sviluppo, al primo avvio, vengono caricati dati di esempio (catalogo + buyer, con un prodotto volutamente *scoperto*) per avere qualcosa con cui lavorare. In produzione l'app parte dal solo catalogo.

---

## Il giorno della distribuzione

**Non usare `npm run dev`.** Il giorno del ritiro va usata una **build di produzione servita in locale**:

```bash
npm run build     # una volta, in anticipo (non durante la giornata)
npm run preview   # avvia il server locale e lascialo aperto tutto il giorno
```

Gira **tutto in locale**: né `build` né `preview` richiedono Internet (le dipendenze sono già installate).

**Perché non `npm run dev`:**

- **Carica i dati di esempio (seed).** In sviluppo, con lo store vuoto, partono buyer e giacenze finti. La build di produzione parte pulita: importi l'Excel vero e inserisci le giacenze reali.
- **Niente offline.** Il service worker PWA (precache + funzionamento senza rete) è generato **solo nella build**; in `dev` non c'è.

> ### ⚠️ Usa sempre la stessa origine (porta + browser)
>
> Lo stato è salvato su **IndexedDB, legato all'origine** (schema + host + **porta**) e al profilo del browser. Le due modalità usano porte diverse — `dev` → `localhost:5173`, `preview` → `localhost:4173` — quindi **i dati di una porta non si vedono nell'altra**.
>
> Scegli **un solo comando, una sola porta, un solo browser/profilo** e usa sempre quello: dalla prova generale fino all'ultimo bonifico spuntato nei giorni successivi. Cambiare comando o browser a metà fa "sparire" i dati (sono sotto un'altra origine).

**Checklist pre-giornata** (da fare qualche giorno prima, sulla **stessa macchina/porta/browser** che userai il giorno del ritiro):

1. `npm run build` — rifallo solo se cambi codice o `public/catalog.json`, **mai** durante la giornata.
2. `npm run preview` e apri `http://localhost:4173`.
3. **Prova generale:** importa l'Excel reale e verifica i conteggi in anteprima; inserisci le **giacenze iniziali** da **Prodotti → Gestione catalogo** (è l'unico punto per farlo).
4. **Ricarica un paio di volte:** buyer e giacenze devono restare (verifica la persistenza *prima* del giorno).
5. *Facoltativo ma consigliato:* **installa la PWA** (icona nella barra degli indirizzi) per aprirla come app a sé, che si regge sulla cache anche se chiudi il terminale.

**Durante la giornata:** lascia `preview` in esecuzione (o usa la PWA installata); non svuotare i dati del sito / la cache; non cambiare browser o profilo; non rifare la build.

---

## Le cinque schermate

| Rotta | Nome | Ruolo |
|---|---|---|
| `/import` | Import | Carica il file, mappa le colonne, anteprima, riconciliazione ordinato vs giacenza. |
| `/banco` | Banco | Operativo, search-first: trova → ordine e importo → pagamento → salva. Calcolo del resto per i contanti. |
| `/magazzino` | Magazzino | Giacenze: barra di capacità per prodotto (ritirati / da consegnare / cuscinetto / scoperto). |
| `/recap` | Recap ordini | Tutti gli ordini, filtrabili, con quadratura. Modifica nel drawer laterale. Export + backup. |
| `/prodotti` | Prodotti | Sola anagrafica del catalogo. Da qui si apre la **gestione catalogo**. |

## Struttura del progetto

```
public/            catalog.json (catalogo di default) + icona PWA
src/
  tokens/          design tokens (TS) + variabili CSS globali
  components/       componenti condivisi (Sidebar, Drawer, Chip, Toast, …)
  screens/          le cinque schermate
  lib/              modello dati, store, selettori puri, persistenza, export
    import/         parsing file, mappatura colonne, riconciliazione
```

## Modello dati

```ts
type PaymentStatus = 'none' | 'cash' | 'pending' | 'received';

interface Product {
  number: number;       // chiave stabile
  nameSv: string;       // nome svedese (mostrato)
  descIt: string;       // descrizione italiana
  photoUrl?: string;
  price: number;        // unica fonte di verità per i prezzi
  initialStock: number; // giacenza iniziale
}

interface Buyer {
  id: string;
  name: string;
  phone?: string;
  order: Record<number, number>; // numeroProdotto -> quantità
  pickedUp: boolean;
  payment: PaymentStatus;
}

interface AppState { catalog: Product[]; buyers: Buyer[]; importedAt?: string; }
```

## Catalogo

Il catalogo è una fonte a sé, con un ciclo di vita diverso dagli ordini, ed è **facilmente sostituibile**: vive in [`public/catalog.json`](public/catalog.json) e viene caricato all'avvio quando lo store è ancora vuoto.

Dalla schermata **Prodotti → Gestione catalogo** si può:

- caricare/sostituire il file di catalogo (JSON);
- impostare la **giacenza iniziale** di ogni prodotto (una tantum, quando arriva la merce);
- modificare prezzo, descrizione e foto.

Prezzo e giacenza iniziale alimentano tutto il resto (totali e magazzino): ogni modifica si riflette subito.

## Dati, backup ed export

- **Persistenza:** IndexedDB (mai `localStorage`). Salvataggio automatico a ogni azione, reidratazione all'avvio prima del primo render.
- **Esporta recap:** CSV di fine giornata con le cinque voci di denaro, la lista ordini con stato e il magazzino (ordinati/ritirati/residuo).
- **Backup:** intero stato in JSON.
- **Nuovo anno:** azzera i buyer (con doppia conferma) conservando il catalogo.

Export, backup e Annulla sono raggiungibili con un click dalla colonna laterale, da qualsiasi schermata.

---

## In sospeso (dati reali non ancora disponibili)

- **Prezzi e formato CSV reale** — verificare se il CSV cita i prodotti per numero o per nome, e riempire `public/catalog.json` con i prezzi veri.
- **Contenuti del catalogo** — descrizioni italiane, nomi svedesi definitivi e foto in `public/catalog.json`.

Finché mancano, si lavora con i dati di esempio (seed di sviluppo).
