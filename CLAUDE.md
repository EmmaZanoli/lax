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
- **Tipo di ordine `kind` ∈ {`customer`, `personal`}, default `customer`.** Un ordine `personal` è merce che il seller tiene per sé, non da rivendere:
  - **fuori dal Banco e da tutti i conteggi del giorno** (niente coda ritiri, niente "devono ritirare");
  - **fuori dai bucket di denaro dei clienti** (contanti / bonifici / non pagato) e dalla **quadratura clienti**;
  - concorre a una voce **separata** nel Recap, *Valore uso personale* = Σ(quantità × prezzo di catalogo);
  - **fuori da ogni calcolo di giacenza/Magazzino**: la merce personale viene tolta fisicamente dalle casse prima della consegna, quindi non è tra i prodotti da ritirare e la giacenza iniziale non la comprende. Gli ordini `personal` **non compaiono** nel Magazzino.
  - Selettori/filtri clienti e di magazzino devono **sempre** filtrare via i `personal` (`isCustomer`/`isPersonal` in `selectors.ts`).
- **I prezzi vivono solo nel catalogo**, mai nel file d'import. Il totale di un buyer si ricalcola sempre come Σ(quantità × prezzo di catalogo). Se il file d'import contenesse un totale, va ignorato.
- **La giacenza la scala il RITIRO (clienti), non il pagamento.** `residual = initialStock − (pezzi clienti con pickedUp=true)`. Gli ordini `personal` non toccano la giacenza.
- **Sorgente d'import ufficiale: l'export del foglio risposte del Google Form** (`ordine.xlsx`/CSV). Un file d'esempio anonimizzato (nomi/telefoni/email finti, quantità reali) vive nel root come `ordine.xlsx` ed è il fixture del test d'import.
- **Il numero di prodotto è la chiave stabile** per l'aggancio catalogo ↔ foglio risposte. Le colonne-prodotto si riconoscono dall'**intero iniziale dell'etichetta** (`^\s*(\d+)\.`): quell'intero È il numero di catalogo. **Aggancio SEMPRE per numero, mai per nome** (le etichette hanno tab, spazi finali e descrizioni incoerenti — es. il prodotto 6 ha la descrizione duplicata/garbled). Le colonne non-prodotto (timestamp, diramazioni "Vuoi ordinare anche altri prodotti?" con eventuale suffisso, "Commenti") vengono ignorate; `email`/`nome`/`telefono` per parola chiave. Gli ordini fuori-form e per uso personale **non** entrano dall'Import (arrivano da "Aggiungi ordine").
- **L'app si usa anche nei giorni dopo** il ritiro (per spuntare i bonifici che arrivano): lo stato deve sopravvivere a chiusura/refresh.

---

## Modello dati

```ts
type PaymentStatus = 'none' | 'cash' | 'pending' | 'received';
type OrderKind = 'customer' | 'personal'; // default 'customer'; 'personal' = merce del seller

interface Product {
  number: number;      // chiave stabile
  nameSv: string;      // nome svedese (mostrato)
  weight: string;      // formato/peso (es. "1/1", "1/2", "300g") — necessario perché lo stesso nameSv può avere formati diversi
  category?: string;   // raggruppamento ("Salmone" / "Anguilla" / "Aringhe")
  descIt: string;      // descrizione italiana
  photoUrl?: string;
  price: number;       // unica fonte di verità per i prezzi
  initialStock: number;// compilata quando arriva la merce
}

interface Buyer {
  id: string;
  name: string;
  phone?: string;
  email?: string; // opzionale; da "Indirizzo email" del foglio risposte
  order: Record<number, number>; // numeroProdotto -> quantità
  pickedUp: boolean;
  payment: PaymentStatus;
  kind: OrderKind; // 'customer' (default) | 'personal' (uso personale del seller)
}

interface AppState { catalog: Product[]; buyers: Buyer[]; importedAt?: string; }
```

Catalogo e buyer hanno **cicli di vita diversi**: il catalogo cambia di rado (file `catalog.json` sostituibile), i buyer si reimportano ogni anno.

## Regole di calcolo (selettori derivati puri)

- `orderTotal(buyer, catalog)` = Σ quantità × prezzo di catalogo.
- `isCustomer(b)` / `isPersonal(b)` distinguono per `kind` (robusti verso dati vecchi: assente ⇒ cliente).
- `totals(state)` → `{ cash, received, pending, unpaid, toPickValue, toPickCount, personal, personalCount, orderedTotal }`. Le prime quattro sono valori € dei soli **clienti ritirati**, ripartiti per stato pagamento; `toPick*` riguarda i **clienti** che non hanno ritirato; `personal*` è la voce separata uso personale; `orderedTotal` = valore di tutto l'ordinato (clienti a ogni stato + personale), per riconciliare la fattura. **Tutti i bucket clienti escludono i `personal`.**
- `stockStatus(state)` per prodotto → `{ ordered, pickedUp, residual = initialStock − pickedUp, delta = initialStock − ordered }`. Opera **solo** sugli ordini `customer` (gli `personal` sono esclusi da ogni calcolo di magazzino). `delta < 0` = prodotto **scoperto** (ammanco al carico).
- `orderedTotals(state)` → `{ rows[{number, customer, personal, total, value}], totalPieces, personalPieces, totalValue }`. **Dato puramente informativo** per la riconciliazione con la **fattura del fornitore** (che include anche i pezzi personali): per ogni prodotto l'ordinato totale = Σ quantità di TUTTI gli ordini (`customer` + `personal`), più i totali complessivi (pezzi e valore). **Non è un selettore di magazzino:** non tocca `stockStatus`, giacenza, residual, delta, "ancora da consegnare", "prodotti scoperti", né i bucket di cassa/quadratura. Mostrato nel Recap in una sezione dedicata, distinta dal Magazzino (solo-clienti) e dalla cassa.
- **Quadratura clienti:** valore ordini **clienti** ritirati = `cash + received + pending + unpaid`. Deve tornare sempre (l'uso personale ne è fuori).

## Le cinque schermate

| Rotta | Nome | Ruolo |
|---|---|---|
| `/import` | Import | Carica l'export del foglio risposte del Google Form, mappa le colonne (prodotti agganciati **per numero**; email/nome/telefono per parola chiave), anteprima con evidenza righe problematiche e **nomi duplicati** (segnalati, mai uniti), riconciliazione ordinato vs giacenza. Salva la mappatura per un reimport immediato dello stesso formato. |
| `/banco` | Banco | Operativo. Search-first, **solo chi non ha ritirato**. Trova → ordine+importo → scegli pagamento → **Salva** → torna alla ricerca. Calcolo resto per i contanti. |
| `/magazzino` | Magazzino | Giacenze. Barra di capacità per prodotto (ritirati / da consegnare / cuscinetto / scoperto). Solo ordini clienti: gli `personal` non incidono sulla giacenza e non compaiono. |
| `/recap` | Recap ordini | Tutti gli ordini, filtrabili (default "Da ritirare"; filtro **Uso personale** dedicato). 5 voci denaro clienti + quadratura, più striscia **Valore uso personale** e **Totale ordinato (clienti + personale)**. Sezione collassabile **Ordinato totale per prodotto · incluso uso personale** (`orderedTotals`), solo per riconciliare la fattura fornitore — distinta da Magazzino e cassa. Righe modificabili nel **drawer** laterale (i `personal` sono in sola lettura, senza ritiro/pagamento). "Aggiungi ordine" ha il selettore Cliente / Uso personale. Export recap + backup. |
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
- Stati semantici: contanti = ottone `#d0a860` · bonifico atteso = blu acciaio `#82a6bb` · bonifico ricevuto = verde salvia `#95b389` · non pagato/allarme = terracotta `#d08869` · uso personale = malva attenuato `#a091b3`.
- **Chip** di stato: colore semantico su fondo tinta ~15-18% + bordo sottile dello stesso colore (delineati, non pieni).
- **Tipografia:** Fraunces (serif) per contenuti "preziosi" — titoli, nomi buyer, nomi svedesi, **tutti gli importi** — con letter-spacing leggermente negativo; Inter (sans) per il resto. Numeri sempre tabulari. Label piccole in maiuscoletto spaziato (~0.16em), attenuate.
- **Layout:** colonna di navigazione a sinistra (~250px) con logotipo (puntino ottone + "lax" serif), voci di sezione, numeri live (cassa, bonifici attesi, da ritirare) e Annulla in fondo; voce attiva = fondo `#3b3d37` + barretta ottone 3px a sinistra. Sotto ~880px si ripiega in barra superiore. Ogni schermata ha intestazione (titolo serif + sottotitolo) e azioni contestuali a destra. Filetti 1px, angoli 10-20px, spaziature generose, righe elenco alte. Toast in alto al centro. Focus e selezione in ottone.

## Terminologia (usarla coerentemente)

seller · buyer · ordine · ritiro (da ritirare / ritirato) · pagamento (da pagare / contanti / bonifico atteso / bonifico ricevuto) · uso personale (merce del seller, fuori dai conti del giorno) · giacenza iniziale / residua · ammanco (prodotto scoperto) · cuscinetto (scorta extra oltre gli ordini) · quadratura · recap · resto.

---

## Cosa NON fare

- Non leggere i prezzi dal CSV: sempre dal catalogo.
- Non introdurre ritiri parziali, clienti fuori lista o modifiche all'ordine.
- Non usare `localStorage`/`sessionStorage`: la persistenza è IndexedDB.
- Non rompere l'invariante `payment ≠ none ⇒ pickedUp`.
- Non far entrare gli ordini `personal` nel Banco, nei bucket di denaro dei clienti, nella quadratura clienti né in alcun calcolo di magazzino (la merce personale è già fuori dalle casse).
- Non scalare la giacenza sul pagamento: solo sul ritiro dei clienti.
- Non mettere numeri di magazzino nella schermata Prodotti (resta pura anagrafica).
- Non trasformare il drawer del Recap in un modale a tutto schermo.
- Non aggiungere backend, login o multi-utente.

## In sospeso (dati reali non ancora disponibili)

- **Formato d'import: RISOLTO.** Il foglio risposte del Google Form cita i prodotti per **numero** (intero iniziale dell'etichetta) → aggancio per numero, tarato sul file reale e coperto da test (`src/lib/import/import.test.ts`, fixture `ordine.xlsx`).
- **Contenuti catalogo** (descrizioni italiane, nomi svedesi definitivi, foto) → in `catalog.json`. I prezzi reali 1–12 sono già in `catalog.json`.

Finché mancano, si lavora con dati di esempio (seed solo in sviluppo, con almeno un prodotto scoperto per testare l'ammanco e un ordine `personal` per testare l'uso personale).