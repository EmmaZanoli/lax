# lax

App per gestire la **giornata di ritiro** (una volta all'anno) di prodotti alimentari svedesi.

Un *seller* ha raccolto ordini via Google Form; i *buyer* vengono di persona, ritirano e pagano. Da solo, il seller trova il buyer, mostra ordine e importo, registra ritiro e pagamento e tiene d'occhio il magazzino. Nei giorni successivi spunta i bonifici che arrivano.

È uno strumento **solo frontend**, da browser su computer, pensato per **una persona su un dispositivo**. L'interfaccia è in **italiano**; i nomi dei prodotti restano in **svedese**.

---

## Deploy su GitHub Pages

**App live:** https://emmazanoli.github.io/lax/

Il deploy avviene **automaticamente a ogni push su `main`** tramite GitHub Actions
(workflow in `.github/workflows/deploy.yml`). Routing con `HashRouter` e base path `/lax/`:
nessuna configurazione server richiesta.

### Primo setup (una volta sola)

1. Vai su **Settings → Pages** del repository su GitHub
2. Sotto **Source**, seleziona **GitHub Actions**
3. Salva

Da quel momento ogni push su `main` ricostruisce e pubblica l'app.
Puoi anche avviare un deploy manuale dalla tab **Actions → Deploy to GitHub Pages → Run workflow**.

### Dati e privacy (repo pubblico)

**Sul repository e sul sito pubblicato non finiscono mai dati personali.**
I dati importati (nomi, telefoni, email dei buyer, ordini) e il catalogo con i prezzi
vivono esclusivamente in IndexedDB nel browser di chi usa l'app e non lasciano mai il dispositivo.

Il `.gitignore` esclude esplicitamente l'export del Google Form (`ordine.xlsx`/`ordine.csv`
e ogni `*.xlsx`/`*.csv`), il catalogo reale (`public/catalog.json`) e i backup/recap esportati
dall'app (`backup-lax-*.json`, …) — solo il codice è pubblico.

---

## Caratteristiche

- **Nessun backend, nessun login.** Tutto vive nel browser.
- **Offline (PWA installabile).** Service worker (Workbox) con precache di codice, stili, HTML, font (self-hosted) e icone. I dati (catalogo e ordini) stanno in IndexedDB, un **livello separato che il service worker non tocca mai**: restano intatti anche attraverso gli aggiornamenti dell'app. Un banner (`registerType: 'prompt'`) segnala la nuova versione e chiede conferma prima di ricaricare.
- **Persistenza a prova di refresh.** Lo stato è salvato su **IndexedDB** a ogni azione e ricaricato all'avvio prima del primo render. All'avvio l'app chiede al browser lo **storage persistente** (`navigator.storage.persist`) per non farsi sfrattare IndexedDB; una guardia avvisa prima di chiudere se ci sono ordini caricati.
- **Import da CSV/XLSX** con mappatura colonne che regge le variazioni annuali del Google Form: i prodotti si agganciano **per numero** (l'intero iniziale dell'etichetta), mai per nome. L'anteprima evidenzia le righe problematiche (nome mancante, ordine vuoto, quantità non intere corrette, nomi duplicati) e riconcilia l'ordinato con la giacenza. La mappatura viene salvata per un reimport immediato dello stesso formato.
- **Uso personale.** Un ordine può essere merce che il seller tiene per sé: fuori dalla coda ritiri, dai conti di cassa, dalla quadratura e dal magazzino, con una voce dedicata nel Recap e nell'export.
- **Sicurezza dei dati.** Backup/ripristino dell'intero stato in JSON, **snapshot automatici** periodici in-app (ring buffer, ripristinabili dalla schermata Backup), un indicatore in sidebar che avvisa quando ci sono modifiche non salvate e — dopo l'export del recap — un invito a salvare anche un backup.
- **Annulla a un livello** sempre disponibile e toast di conferma su ogni azione.

## Regole di dominio (invarianti)

- Ordini **immutabili**: al ritiro si cambia solo lo *stato*, mai il contenuto. Nessun cliente fuori lista. *Unica eccezione all'esistenza (non al contenuto):* un ordine aggiunto a mano può essere eliminato dal Recap; gli ordini importati mai.
- Il **ritiro è sempre totale**, mai parziale.
- Due stati indipendenti per buyer: `pickedUp` (bool) e `payment` ∈ `none | cash | pending | received`, con l'invariante **`payment ≠ none ⇒ pickedUp = true`**.
- I **prezzi vivono solo nel catalogo**: il totale si ricalcola sempre come Σ(quantità × prezzo). Eventuali totali nel file d'import sono ignorati.
- La **giacenza la scala il ritiro dei clienti**, non il pagamento: `residuo = giacenza iniziale − pezzi ritirati`.
- Il **numero di prodotto** è la chiave stabile per l'aggancio catalogo ↔ foglio risposte.
- Gli ordini **`personal`** (uso personale) restano fuori da Banco, bucket di denaro dei clienti, quadratura clienti e da ogni calcolo di magazzino.

---

## Stack

- **Vite + React + TypeScript**
- **Zustand** con middleware `persist` su **IndexedDB** (storage custom via `idb-keyval`)
- **react-router-dom** con `HashRouter` (rotta di default `/banco`)
- **papaparse** (CSV) ed **ExcelJS** (lettura `.xlsx` in import + generazione del recap Excel), caricati con import dinamico
- Font **self-hosted**: `@fontsource-variable/fraunces` e `@fontsource/inter`
- **vite-plugin-pwa** (Workbox) per l'uso offline
- **Vitest** per i test della logica di dominio

## Requisiti

- Node.js 20+ (CI e sviluppo su Node 22) e npm.

## Comandi

```bash
npm install       # installa le dipendenze
npm run dev       # avvia l'ambiente di sviluppo (apre il browser)
npm run build     # genera le icone PWA + type-check + build di produzione in dist/
npm run preview   # serve la build (utile per provare l'offline/PWA)
npm run typecheck # solo controllo dei tipi
npm test          # esegue i test (Vitest)
```

Per provare il funzionamento offline: `npm run build && npm run preview`, apri l'app, poi disattiva la rete e ricarica.

---

## Il giorno della distribuzione

**Non usare `npm run dev`.** Il giorno del ritiro va usata una **build di produzione servita in locale**:

```bash
npm run build     # una volta, in anticipo (non durante la giornata)
npm run preview   # avvia il server locale e lascialo aperto tutto il giorno
```

Gira **tutto in locale**: né `build` né `preview` richiedono Internet (le dipendenze sono già installate).

**Perché la build e non `dev`:**

- **L'offline esiste solo nella build.** Il service worker PWA (precache + funzionamento senza rete) è generato **solo da `npm run build`**; in `dev` non c'è.
- **Parte pulita.** Niente buyer finti: la build parte dal solo **catalogo** (caricato una volta da `public/catalog.json`, o richiesto a schermo se assente). Importi l'Excel vero e imposti le giacenze reali.

> ### ⚠️ Usa sempre la stessa origine (porta + browser)
>
> Lo stato è salvato su **IndexedDB, legato all'origine** (schema + host + **porta**) e al profilo del browser. Le due modalità usano porte diverse — `dev` → `localhost:5173`, `preview` → `localhost:4173` — quindi **i dati di una porta non si vedono nell'altra**.
>
> Scegli **un solo comando, una sola porta, un solo browser/profilo** e usa sempre quello: dalla prova generale fino all'ultimo bonifico spuntato nei giorni successivi. Cambiare comando o browser a metà fa "sparire" i dati (sono sotto un'altra origine).

**Checklist pre-giornata** (da fare qualche giorno prima, sulla **stessa macchina/porta/browser** che userai il giorno del ritiro):

1. `npm run build` — rifallo solo se cambi codice o `public/catalog.json`, **mai** durante la giornata.
2. `npm run preview` e apri `http://localhost:4173`.
3. **Prova generale:** importa l'Excel reale e verifica i conteggi in anteprima; inserisci le **giacenze iniziali** da **Magazzino → Modifica giacenze** (quando arriva la merce).
4. **Ricarica un paio di volte:** buyer e giacenze devono restare (verifica la persistenza *prima* del giorno).
5. *Facoltativo ma consigliato:* **installa la PWA** (icona nella barra degli indirizzi) per aprirla come app a sé, che si regge sulla cache anche se chiudi il terminale.
6. Esporta un **backup** e verifica di saperlo ripristinare.

**Durante la giornata:** lascia `preview` in esecuzione (o usa la PWA installata); non svuotare i dati del sito / la cache; non cambiare browser o profilo; non rifare la build. Esporta un backup più volte come rete di sicurezza.

---

## Le sei schermate

| Rotta | Nome | Ruolo |
|---|---|---|
| `/import` | Import | Carica l'export del Google Form, mappa le colonne (prodotti per numero), anteprima con righe problematiche e nomi duplicati, riconciliazione ordinato vs giacenza. Salva la mappatura per il reimport. |
| `/banco` | Banco | Operativo, search-first (solo chi non ha ritirato): trova → ordine e importo → pagamento → salva. Navigazione da tastiera (frecce/Invio), calcolo del resto per i contanti. |
| `/magazzino` | Magazzino | Giacenze per prodotto (solo ordini clienti): barra ritirati / da consegnare / cuscinetto / scoperto. Qui si impostano e modificano le **giacenze iniziali**. |
| `/recap` | Recap ordini | Tutti gli ordini, filtrabili (incluso *Uso personale*), con quadratura clienti. Modifica nel drawer laterale; "Aggiungi ordine" (cliente o uso personale) ed eliminazione dei soli ordini manuali. |
| `/prodotti` | Prodotti | Sola anagrafica del catalogo (nessun dato di magazzino). Da qui la **gestione catalogo** (file, prezzo, descrizione, foto). |
| `/backup` | Backup | Esporta e ripristina l'intero stato in JSON (validazione + conferma). Percorso di recupero da disastro e di trasferimento tra dispositivi. |

## Struttura del progetto

```
public/            catalog.json (catalogo di default, non versionato) + icone PWA
src/
  tokens/          design tokens (TS) + variabili CSS globali
  components/       componenti condivisi (Sidebar, Drawer, Chip, Toast, …)
  screens/          le sei schermate
  lib/              modello dati, store, selettori puri, persistenza, export
    import/         parsing file, mappatura colonne, riconciliazione
```

## Modello dati

```ts
type PaymentStatus = 'none' | 'cash' | 'pending' | 'received';
type OrderKind = 'customer' | 'personal'; // default 'customer'

interface Product {
  number: number;       // chiave stabile (aggancio col foglio risposte)
  nameSv: string;       // nome svedese (mostrato)
  weight: string;       // formato/peso (es. "1/1", "300g")
  category?: string;    // raggruppamento (es. Salmone / Anguilla / Aringhe)
  descIt: string;       // descrizione italiana
  photoUrl?: string;
  price: number;        // unica fonte di verità per i prezzi
  initialStock: number; // giacenza iniziale
}

interface Buyer {
  id: string;
  name: string;
  phone?: string;
  email?: string;                // da "Indirizzo email" del foglio risposte
  order: Record<number, number>; // numeroProdotto -> quantità
  pickedUp: boolean;
  payment: PaymentStatus;
  kind: OrderKind;               // 'customer' (default) | 'personal'
  manual?: boolean;              // true se aggiunto a mano dal Recap (eliminabile)
}

interface AppState { catalog: Product[]; buyers: Buyer[]; importedAt?: string; }
```

## Catalogo

Il catalogo ha un ciclo di vita diverso dagli ordini (cambia di rado) ed è **facilmente sostituibile**. Contiene prezzi e anagrafica: è un **dato locale privato e non versionato**.

- **In sviluppo / build locale:** vive in `public/catalog.json` e viene caricato all'avvio se IndexedDB è ancora vuoto. Se il catalogo è già persistito, resta quello (la giacenza iniziale inserita non viene mai sovrascritta da un reload).
- **Sul sito pubblico:** `catalog.json` non è nel bundle. Al primo avvio l'app mostra una schermata di benvenuto ("Carica il catalogo per iniziare") con un caricatore di file; da lì in poi il catalogo persiste in IndexedDB su quel browser.

Dalla schermata **Prodotti → Gestione catalogo** si può caricare/sostituire il file di catalogo (JSON) e modificare **prezzo, descrizione e foto**. Le **giacenze iniziali** si impostano invece dal **Magazzino** (Prodotti resta pura anagrafica). Prezzo e giacenza alimentano tutto il resto (totali e magazzino): ogni modifica si riflette subito.

## Dati, backup ed export

- **Persistenza:** IndexedDB (mai `localStorage`), via `idb-keyval`. Salvataggio automatico a ogni azione, reidratazione all'avvio prima del primo render; storage persistente richiesto al browser all'avvio.
- **Esporta recap:** file **Excel** (`lax-recap-AAAA-MM-GG.xlsx`, generato con ExcelJS) a 5 fogli — Riepilogo (KPI + quadratura), Ordini (clienti), Magazzino (clienti), Uso personale (itemizzato per prodotto), Fornitore (clienti + personale, per riconciliare la fattura). Usa formule Excel dove opportuno. Pulsante nella sidebar; **dopo l'export un toast propone di salvare anche un backup**.
- **Backup/ripristino:** dalla schermata `/backup`, l'intero stato in JSON (`backup-lax-…json`); il ripristino valida il file, chiede conferma e normalizza l'invariante pagamento⇒ritiro. Un indicatore in sidebar mostra da quanto non si fa un backup e avvisa se ci sono modifiche non salvate.
- **Snapshot automatici:** ogni pochi minuti, se i dati sono cambiati, l'app salva silenziosamente uno snapshot in IndexedDB (ring buffer degli ultimi ~20), ripristinabile dalla schermata `/backup`. È una rete di sicurezza in-app per gli errori operativi (un «Nuovo anno» sbagliato, un ripristino errato, azioni di troppo oltre l'undo); vivendo nello stesso IndexedDB **non sostituisce** i backup su file. Si azzerano con «Nuovo anno».
- **Nuovo anno:** azzera i buyer (con doppia conferma) conservando il catalogo.
- **Annulla:** snapshot a un livello prima di ogni mutazione.

Esporta recap, Annulla e Nuovo anno sono nella colonna laterale (da qualsiasi schermata); l'indicatore di backup porta alla schermata `/backup`.

---

## Test

La logica di dominio è coperta da **Vitest**: selettori di denaro e magazzino, l'invariante `payment ≠ none ⇒ pickedUp` nello store, il parsing dell'import sul **foglio reale** (`ordine.xlsx`, fixture anonimizzata) con l'aggancio prodotti per numero, la gestione delle anomalie (ordine vuoto, quantità non intere corrette, nomi duplicati), l'anti-perdita-dati e la logica di avvio (`resolveBootstrap`).

```bash
npm test          # esegue la suite una volta
npm run test:watch
```
