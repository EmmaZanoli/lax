# lax — contesto di progetto

App per gestire **una giornata di ritiro** (una volta all'anno) di prodotti alimentari svedesi. Un *seller* ha raccolto ordini via Google Form; i *buyer* vengono di persona, ritirano e pagano. Il seller, da solo, trova il buyer, mostra ordine e importo, registra ritiro e pagamento, e tiene d'occhio il magazzino. Strumento **solo frontend**, da browser su computer, usato da **una persona su un dispositivo**.

L'interfaccia è in **italiano**; i nomi dei prodotti restano in **svedese**.

---

## Regole di dominio (invarianti — non violarle mai)

- **Un solo utente, un solo dispositivo.** Niente backend, niente autenticazione, niente concorrenza.
- **Ordini immutabili.** Nessun cliente fuori lista, nessuna modifica all'ordine al momento del ritiro. Si può cambiare solo lo *stato* (ritiro/pagamento), mai il contenuto.
- **Il ritiro è sempre totale**, mai parziale.
- **Due stati indipendenti per buyer:** `pickedUp` (bool) e `payment` ∈ {`none`, `cash`, `pending`, `received`}.
- **Invariante forte:** `payment ≠ none` ⇒ `pickedUp = true`. Le azioni devono garantirlo; annullare il ritiro riporta `payment` a `none`.
- **I prezzi vivono solo nel catalogo**, mai nel CSV. Il totale di un buyer si ricalcola sempre come Σ(quantità × prezzo di catalogo). Se il file d'import contenesse un totale, va ignorato.
- **La giacenza la scala il RITIRO, non il pagamento.** `residual = initialStock − (pezzi negli ordini con pickedUp=true)`.
- **Il numero di prodotto è la chiave stabile** per l'aggancio catalogo ↔ CSV (preferirlo al nome svedese).
- **L'app si usa anche nei giorni dopo** il ritiro (per spuntare i bonifici che arrivano): lo stato deve sopravvivere a chiusura/refresh.

---

## Modello dati

```ts
type PaymentStatus = 'none' | 'cash' | 'pending' | 'received';

interface Product {
  number: number;      // chiave stabile
  nameSv: string;      // nome svedese (mostrato)
  descIt: string;      // descrizione italiana
  photoUrl?: string;
  price: number;       // unica fonte di verità per i prezzi
  initialStock: number;// compilata quando arriva la merce
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

Catalogo e buyer hanno **cicli di vita diversi**: il catalogo cambia di rado (file `catalog.json` sostituibile), i buyer si reimportano ogni anno.

## Regole di calcolo (selettori derivati puri)

- `orderTotal(buyer, catalog)` = Σ quantità × prezzo di catalogo.
- `totals(state)` → `{ cash, received, pending, unpaid, toPickValue, toPickCount }`. Le prime quattro sono valori € dei soli buyer **ritirati**, ripartiti per stato pagamento; `toPick*` riguarda chi **non** ha ritirato.
- `stockStatus(state)` per prodotto → `{ ordered, pickedUp, residual = initialStock − pickedUp, delta = initialStock − ordered }`. `delta < 0` = prodotto **scoperto** (ammanco al carico).
- **Quadratura:** valore ordini ritirati = `cash + received + pending + unpaid`. Deve tornare sempre.

## Le cinque schermate

| Rotta | Nome | Ruolo |
|---|---|---|
| `/import` | Import | Carica file, mappa colonne, anteprima, riconciliazione ordinato vs giacenza. |
| `/banco` | Banco | Operativo. Search-first, **solo chi non ha ritirato**. Trova → ordine+importo → scegli pagamento → **Salva** → torna alla ricerca. Calcolo resto per i contanti. |
| `/magazzino` | Magazzino | Giacenze. Barra di capacità per prodotto (ritirati / da consegnare / cuscinetto / scoperto). |
| `/recap` | Recap ordini | Tutti gli ordini, filtrabili (default "Da ritirare"). 5 voci denaro + quadratura. Righe modificabili nel **drawer** laterale. Export recap + backup. |
| `/prodotti` | Prodotti | Sola anagrafica: nome sv, numero, descrizione it, foto, prezzo. **Nessun dato di magazzino qui.** |

---

## Stack e convenzioni tecniche

- **Vite + React + TypeScript.**
- **Stato:** Zustand con middleware `persist` su **IndexedDB** (storage custom via `idb-keyval`). Salvataggio automatico a ogni azione; ricarica all'avvio. **Mai `localStorage`.**
- **Routing:** `react-router-dom` (default `/banco`).
- **Font:** self-hosted via `@fontsource-variable/fraunces` e `@fontsource/inter` (l'app deve girare offline; niente link a Google Fonts).
- **PWA** con service worker per l'uso offline durante la giornata.
- **Selettori** puri e separati dallo store, facilmente testabili.
- **Undo** a un livello: snapshot prima di ogni mutazione.
- Cartelle: `tokens/`, `components/` (condivisi), `screens/`, `lib/` (selettori, persistenza, import).

Comandi: `npm run dev`, `npm run build`, `npm run preview`.

## Design system — "pietra ollare & ottone"

Grafite caldo mid-dark con un unico accento **ottone** (denaro / luce di candela). Definito in un modulo tokens + CSS variables.

- Colori: fondo `#2a2b27` · pannelli `#323430` · superfici/input `#3b3d37` · rialzo `#44463f` · filetti `#484a42` / soft `#3a3c36` · testo `#eee9dd` / attenuato `#a7a294` / debole `#7c786c` · ottone `#d0a860`, scuro `#8f7642`, testo su ottone `#26251f`.
- Stati semantici: contanti = ottone `#d0a860` · bonifico atteso = blu acciaio `#82a6bb` · bonifico ricevuto = verde salvia `#95b389` · non pagato/allarme = terracotta `#d08869`.
- **Chip** di stato: colore semantico su fondo tinta ~15-18% + bordo sottile dello stesso colore (delineati, non pieni).
- **Tipografia:** Fraunces (serif) per contenuti "preziosi" — titoli, nomi buyer, nomi svedesi, **tutti gli importi** — con letter-spacing leggermente negativo; Inter (sans) per il resto. Numeri sempre tabulari. Label piccole in maiuscoletto spaziato (~0.16em), attenuate.
- **Layout:** colonna di navigazione a sinistra (~250px) con logotipo (puntino ottone + "lax" serif), voci di sezione, numeri live (cassa, bonifici attesi, da ritirare) e Annulla in fondo; voce attiva = fondo `#3b3d37` + barretta ottone 3px a sinistra. Sotto ~880px si ripiega in barra superiore. Ogni schermata ha intestazione (titolo serif + sottotitolo) e azioni contestuali a destra. Filetti 1px, angoli 10-20px, spaziature generose, righe elenco alte. Toast in alto al centro. Focus e selezione in ottone.

## Terminologia (usarla coerentemente)

seller · buyer · ordine · ritiro (da ritirare / ritirato) · pagamento (da pagare / contanti / bonifico atteso / bonifico ricevuto) · giacenza iniziale / residua · ammanco (prodotto scoperto) · cuscinetto (scorta extra oltre gli ordini) · quadratura · recap · resto.

---

## Cosa NON fare

- Non leggere i prezzi dal CSV: sempre dal catalogo.
- Non introdurre ritiri parziali, clienti fuori lista o modifiche all'ordine.
- Non usare `localStorage`/`sessionStorage`: la persistenza è IndexedDB.
- Non rompere l'invariante `payment ≠ none ⇒ pickedUp`.
- Non scalare la giacenza sul pagamento: solo sul ritiro.
- Non mettere numeri di magazzino nella schermata Prodotti (resta pura anagrafica).
- Non trasformare il drawer del Recap in un modale a tutto schermo.
- Non aggiungere backend, login o multi-utente.

## In sospeso (dati reali non ancora disponibili)

- **Prezzi + formato CSV reale** → verificare se il CSV cita i prodotti per **numero** (aggancio immediato) o per nome. Riempire `catalog.json` con i prezzi veri.
- **Contenuti catalogo** (descrizioni italiane, nomi svedesi definitivi, foto) → in `catalog.json`.

Finché mancano, si lavora con dati di esempio (seed solo in sviluppo, con almeno un prodotto scoperto per testare l'ammanco).