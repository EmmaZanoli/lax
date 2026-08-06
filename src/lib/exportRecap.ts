import type { Cell, Fill, Workbook } from 'exceljs';
import type { AppState } from './types';
import {
  totals,
  pickedUpValue,
  stockStatus,
  orderedTotals,
  orderTotal,
  orderPieces,
  isCustomer,
  isPersonal,
} from './selectors';
import { isBalanced } from './export';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  ink:      'FF2B2B28',
  mute:     'FF6F6A5F',
  brass:    'FFC79A4E',
  brassDk:  'FF7D6127',
  tint:     'FFF4ECDB',
  band:     'FFFBF7EF',
  line:     'FFE3D6B6',
  panel:    'FFFAF7F0',
  white:    'FFFFFFFF',
  hairline: 'FFEFEAE0',
} as const;

const STATE = {
  cash:     { fill: 'FFFCEFD2', text: 'FF8A6A1F' },
  received: { fill: 'FFDDEAD6', text: 'FF41663B' },
  pending:  { fill: 'FFDCE6EC', text: 'FF33566B' },
  alarm:    { fill: 'FFF3DDD4', text: 'FFA24E33' },
  neutral:  { fill: 'FFEFEBE1', text: 'FF6F6A5F' },
} as const;

const FMT_EUR = '#,##0.00" €"';
const FMT_INT = '#,##0';

// ── Utils ─────────────────────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(buf: ArrayBuffer | Buffer, filename: string): void {
  const blob = new Blob([buf as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Imposta un valore numerico/testo oppure una formula con risultato precalcolato. */
function fv(formula: string, result: number): { formula: string; result: number } {
  return { formula, result };
}

function solid(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

// ── Cell style primitives ─────────────────────────────────────────────────────

function applyFill(cell: Cell, argb: string): void {
  cell.fill = solid(argb);
}

function applyFont(
  cell: Cell,
  opts: { name?: string; size?: number; bold?: boolean; italic?: boolean; color?: string },
): void {
  cell.font = {
    ...cell.font,
    ...(opts.name   != null && { name: opts.name }),
    ...(opts.size   != null && { size: opts.size }),
    ...(opts.bold   != null && { bold: opts.bold }),
    ...(opts.italic != null && { italic: opts.italic }),
    ...(opts.color  != null && { color: { argb: opts.color } }),
  };
}

function addBorder(
  cell: Cell,
  edge: 'top' | 'bottom' | 'left' | 'right',
  style: 'thin' | 'medium' | 'thick' | 'hair',
  argb: string,
): void {
  const b = cell.border ?? {};
  cell.border = { ...b, [edge]: { style, color: { argb } } };
}

// ── Reusable style patterns ───────────────────────────────────────────────────

function hdrCell(cell: Cell, a: 'left' | 'center' = 'center'): void {
  applyFill(cell, C.brassDk);
  cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: C.white } };
  cell.alignment = { horizontal: a, vertical: 'middle', wrapText: true };
  cell.border = { bottom: { style: 'medium', color: { argb: C.brassDk } } };
}

function bandCell(cell: Cell, odd: boolean): void {
  applyFill(cell, odd ? C.white : C.band);
  cell.border = { bottom: { style: 'thin', color: { argb: C.hairline } } };
}

function chipCell(cell: Cell, s: { fill: string; text: string }): void {
  applyFill(cell, s.fill);
  cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: s.text } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function totCell(cell: Cell, a: 'left' | 'center' | 'right' = 'right'): void {
  applyFill(cell, C.tint);
  cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: C.ink } };
  cell.alignment = { horizontal: a, vertical: 'middle' };
  addBorder(cell, 'top', 'medium', C.brass);
}

// ── Sheet 1: Riepilogo ────────────────────────────────────────────────────────
//
// I KPI usano SUMPRODUCT/COUNTIF sul foglio Ordini (cross-sheet).
// La quadratura è una formula IF.
// La riconciliazione fornitore referenzia la riga totale del foglio Fornitore.
// ordiniLastDataRow: ultima riga dati di Ordini (5 + customerCount - 1)
// fornitoreTotal:    riga totale di Fornitore   (5 + fornitoreRowCount)

function buildRiepilogo(
  wb: Workbook,
  state: AppState,
  ordiniLastDataRow: number,
  fornitoreTotal: number,
): void {
  const ws = wb.addWorksheet('Riepilogo');
  ws.views = [{ showGridLines: false }];

  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 17;
  ws.getColumn(3).width = 17;
  ws.getColumn(4).width = 3;
  ws.getColumn(5).width = 17;
  ws.getColumn(6).width = 17;

  const t = totals(state);
  const ordered = orderedTotals(state);
  const dateStr = new Date().toLocaleDateString('it-IT');

  // Ranges cross-sheet (Ordini: E=Ritiro col5, F=Pagamento col6, D=Totale col4)
  const oE = `Ordini!E5:E${ordiniLastDataRow}`;
  const oF = `Ordini!F5:F${ordiniLastDataRow}`;
  const oD = `Ordini!D5:D${ordiniLastDataRow}`;

  // Row 2: "lax" + data generazione
  ws.getRow(2).height = 38;
  ws.mergeCells('B2:C2');
  const laxCell = ws.getCell('B2');
  laxCell.value = 'lax';
  laxCell.font = { name: 'Georgia', bold: true, size: 30, color: { argb: C.brassDk } };
  laxCell.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('E2:F2');
  const dateCell = ws.getCell('E2');
  dateCell.value = `Generato il ${dateStr}`;
  dateCell.font = { name: 'Arial', size: 9, color: { argb: C.mute } };
  dateCell.alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 3: sottotitolo
  ws.getRow(3).height = 22;
  ws.mergeCells('B3:F3');
  const sub3 = ws.getCell('B3');
  sub3.value = 'Recap della giornata di ritiro';
  sub3.font = { name: 'Arial', size: 12, color: { argb: C.mute } };
  sub3.alignment = { horizontal: 'left', vertical: 'middle' };

  // Row 4: filetto ottone
  ws.getRow(4).height = 3;
  for (let c = 2; c <= 6; c++) applyFill(ws.getCell(4, c), C.brass);

  // 6 schede KPI con formule cross-sheet
  const CARDS = [
    {
      label:   'CONTANTI IN CASSA',
      value:   t.cash,
      fmt:     FMT_EUR,
      s:       STATE.cash,
      formula: `SUMPRODUCT((${oE}="Ritirato")*(${oF}="Contanti")*${oD})`,
    },
    {
      label:   'BONIFICI RICEVUTI',
      value:   t.received,
      fmt:     FMT_EUR,
      s:       STATE.received,
      formula: `SUMPRODUCT((${oE}="Ritirato")*(${oF}="Bonifico ricevuto")*${oD})`,
    },
    {
      label:   'BONIFICI ATTESI',
      value:   t.pending,
      fmt:     FMT_EUR,
      s:       STATE.pending,
      formula: `SUMPRODUCT((${oE}="Ritirato")*(${oF}="Bonifico atteso")*${oD})`,
    },
    {
      label:   'RITIRATO, NON PAGATO',
      value:   t.unpaid,
      fmt:     FMT_EUR,
      s:       STATE.alarm,
      formula: `SUMPRODUCT((${oE}="Ritirato")*(${oF}="Da pagare")*${oD})`,
    },
    {
      label:   'DEVONO RITIRARE (valore)',
      value:   t.toPickValue,
      fmt:     FMT_EUR,
      s:       STATE.neutral,
      formula: `SUMPRODUCT((${oE}="Da ritirare")*${oD})`,
    },
    {
      label:   'DEVONO RITIRARE (persone)',
      value:   t.toPickCount,
      fmt:     FMT_INT,
      s:       STATE.neutral,
      formula: `COUNTIF(${oE},"Da ritirare")`,
    },
  ];

  const cardBaseRows = [6, 10, 14] as const;
  const cardColPairs = [[2, 3], [5, 6]] as const;

  CARDS.forEach((card, i) => {
    const baseRow = cardBaseRows[Math.floor(i / 2)];
    const [sc, ec] = cardColPairs[i % 2];

    ws.getRow(baseRow).height     = 18;
    ws.getRow(baseRow + 1).height = 26;
    ws.getRow(baseRow + 2).height = 16;

    // Label (riga singola)
    ws.mergeCells(baseRow, sc, baseRow, ec);
    const lc = ws.getCell(baseRow, sc);
    lc.value = card.label;
    applyFill(lc, C.panel);
    lc.font = { name: 'Arial', bold: true, size: 8, color: { argb: card.s.text } };
    lc.alignment = { horizontal: 'center', vertical: 'middle' };
    lc.border = {
      top:   { style: 'thin',  color: { argb: C.line } },
      right: { style: 'thin',  color: { argb: C.line } },
      left:  { style: 'thick', color: { argb: card.s.text } },
    };

    // Valore (2 righe unite) — formula cross-sheet con risultato precalcolato
    ws.mergeCells(baseRow + 1, sc, baseRow + 2, ec);
    const vc = ws.getCell(baseRow + 1, sc);
    vc.value  = fv(card.formula, card.value);
    vc.numFmt = card.fmt;
    applyFill(vc, C.panel);
    vc.font = { name: 'Georgia', bold: true, size: 20, color: { argb: C.ink } };
    vc.alignment = { horizontal: 'center', vertical: 'middle' };
    vc.border = {
      bottom: { style: 'thin',  color: { argb: C.line } },
      right:  { style: 'thin',  color: { argb: C.line } },
      left:   { style: 'thick', color: { argb: card.s.text } },
    };
  });

  // Row 17: spaziatore
  ws.getRow(17).height = 8;

  // Riga 18: esito quadratura come formula IF
  ws.getRow(18).height = 22;
  ws.mergeCells('B18:F18');
  const quadCell = ws.getCell('B18');
  const balanced = isBalanced(state);
  const pickedVal = pickedUpValue(t);
  // valoreRitirato (tutti i ritirato sul foglio Ordini) vs somma dei 4 bucket KPI
  quadCell.value = {
    formula: `IF(ROUND(SUMPRODUCT((${oE}="Ritirato")*${oD})-(B7+E7+B11+E11),2)=0,"✓  I conti quadrano","⚠  Conti da verificare")`,
    result: balanced ? '✓  I conti quadrano' : '⚠  Conti da verificare',
  };
  if (balanced) {
    applyFill(quadCell, STATE.received.fill);
    quadCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: STATE.received.text } };
  } else {
    applyFill(quadCell, STATE.alarm.fill);
    quadCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: STATE.alarm.text } };
  }
  quadCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Riga 19: descrizione quadratura (valore testuale con numero formattato — no formula)
  ws.getRow(19).height = 18;
  ws.mergeCells('B19:F19');
  const quadDesc = ws.getCell('B19');
  const fmtVal = pickedVal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  quadDesc.value = `Valore ritirato ${fmtVal} €  =  contanti + bonifici ricevuti + attesi + non pagato`;
  applyFill(quadDesc, C.panel);
  quadDesc.font = { name: 'Arial', size: 9, color: { argb: C.mute } };
  quadDesc.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 20: spaziatore
  ws.getRow(20).height = 8;

  // Righe 22-23: riconciliazione fornitore
  ws.getRow(22).height = 18;
  ws.mergeCells('B22:F22');
  const recoLabel = ws.getCell('B22');
  recoLabel.value = 'Riconciliazione fornitore (incluso uso personale)';
  recoLabel.font = { name: 'Arial', bold: true, size: 10, color: { argb: C.brass } };
  recoLabel.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.getRow(23).height = 22;
  for (let c = 2; c <= 6; c++) applyFill(ws.getCell(23, c), C.tint);

  // Pezzi totali — formula: concatena il valore della riga totale Fornitore col testo
  ws.mergeCells('B23:D23');
  const reco1 = ws.getCell('B23');
  reco1.value = {
    formula: `Fornitore!F${fornitoreTotal}&" pezzi in totale"`,
    result:  `${ordered.totalPieces} pezzi in totale`,
  };
  applyFill(reco1, C.tint);
  reco1.font = { name: 'Arial', bold: true, size: 10, color: { argb: C.brassDk } };
  reco1.alignment = { horizontal: 'left', vertical: 'middle' };

  // Valore totale — formula: cell reference alla riga totale Fornitore
  ws.mergeCells('E23:F23');
  const reco2 = ws.getCell('E23');
  reco2.value  = fv(`Fornitore!G${fornitoreTotal}`, ordered.totalValue);
  reco2.numFmt = FMT_EUR;
  applyFill(reco2, C.tint);
  reco2.font = { name: 'Georgia', bold: true, size: 10, color: { argb: C.brassDk } };
  reco2.alignment = { horizontal: 'right', vertical: 'middle' };

  // Riga 26: nota
  ws.getRow(26).height = 16;
  ws.mergeCells('B26:F26');
  const nota = ws.getCell('B26');
  nota.value = 'I dati dei clienti restano sul dispositivo. Dettaglio negli altri fogli.';
  nota.font = { name: 'Arial', size: 8.5, color: { argb: C.mute } };
  nota.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.pageSetup = {
    orientation: 'portrait',
    fitToPage:   true,
    fitToWidth:  1,
    fitToHeight: 1,
    printArea:   'A1:F27',
  };
}

// ── Sheet 2: Ordini ───────────────────────────────────────────────────────────
// Riga totale con SUM(Pezzi) e SUM(Totale).

function buildOrdini(wb: Workbook, state: AppState): void {
  const ws = wb.addWorksheet('Ordini');

  [26, 16, 9, 14, 14, 20].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getRow(1).height = 28;
  ws.mergeCells('A1:F1');
  const t1 = ws.getCell('A1');
  t1.value = 'Ordini';
  t1.font = { name: 'Georgia', size: 18, color: { argb: C.brassDk } };
  t1.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A2:F2');
  const s2 = ws.getCell('A2');
  s2.value = 'Dettaglio di tutti gli ordini dei clienti';
  s2.font = { name: 'Arial', size: 10, color: { argb: C.mute } };
  s2.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.getRow(3).height = 6;

  // Header riga 4
  ws.getRow(4).height = 20;
  const HDRS = ['Nome', 'Telefono', 'Pezzi', 'Totale', 'Ritiro', 'Pagamento'];
  HDRS.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h;
    hdrCell(cell, i === 0 ? 'left' : 'center');
  });

  // Righe dati: solo clienti, da ritirare prima poi per nome
  const customers = state.buyers
    .filter(isCustomer)
    .sort((a, b) => {
      if (a.pickedUp !== b.pickedUp) return a.pickedUp ? 1 : -1;
      return a.name.localeCompare(b.name, 'it');
    });

  let sumPieces = 0;
  let sumValue  = 0;

  customers.forEach((buyer, i) => {
    const rn  = 5 + i;
    const odd = i % 2 === 0;
    const pieces = orderPieces(buyer);
    const value  = orderTotal(buyer, state.catalog);
    sumPieces += pieces;
    sumValue  += value;

    ws.getRow(rn).height = 18;

    const ritiroLabel = buyer.pickedUp ? 'Ritirato' : 'Da ritirare';
    const pagLabel = !buyer.pickedUp        ? 'Da ritirare'
      : buyer.payment === 'cash'            ? 'Contanti'
      : buyer.payment === 'received'        ? 'Bonifico ricevuto'
      : buyer.payment === 'pending'         ? 'Bonifico atteso'
      : 'Da pagare';

    const rowData: (string | number)[] = [
      buyer.name, buyer.phone ?? '', pieces, value, ritiroLabel, pagLabel,
    ];

    rowData.forEach((v, ci) => {
      const cell = ws.getCell(rn, ci + 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell.value = v as any;
      bandCell(cell, odd);
      cell.font = { name: 'Arial', size: 10, color: { argb: C.ink } };
      cell.alignment = { horizontal: ci <= 1 ? 'left' : 'center', vertical: 'middle' };
      if (ci === 2) cell.numFmt = FMT_INT;
      if (ci === 3) cell.numFmt = FMT_EUR;
    });

    // Chip Ritiro
    chipCell(ws.getCell(rn, 5), buyer.pickedUp ? STATE.received : STATE.alarm);
    addBorder(ws.getCell(rn, 5), 'bottom', 'thin', C.hairline);

    // Chip Pagamento
    const pagState = !buyer.pickedUp       ? STATE.neutral
      : buyer.payment === 'cash'           ? STATE.cash
      : buyer.payment === 'received'       ? STATE.received
      : buyer.payment === 'pending'        ? STATE.pending
      : STATE.alarm;
    chipCell(ws.getCell(rn, 6), pagState);
    addBorder(ws.getCell(rn, 6), 'bottom', 'thin', C.hairline);
  });

  // Riga totale con SUM
  const tn = 5 + customers.length;
  ws.getRow(tn).height = 20;
  for (let c = 1; c <= 6; c++) totCell(ws.getCell(tn, c), c === 1 ? 'left' : 'right');
  ws.getCell(tn, 1).value = 'Totale';

  const cPezzi = ws.getCell(tn, 3);
  cPezzi.value  = fv(`SUM(C5:C${tn - 1})`, sumPieces);
  cPezzi.numFmt = FMT_INT;

  const cTot = ws.getCell(tn, 4);
  cTot.value  = fv(`SUM(D5:D${tn - 1})`, sumValue);
  cTot.numFmt = FMT_EUR;

  ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  ws.autoFilter = `A4:F${tn - 1}`;
  ws.pageSetup = {
    orientation:   'landscape',
    fitToPage:     true,
    fitToWidth:    1,
    fitToHeight:   0,
    printTitlesRow: '4:4',
  };
}

// ── Sheet 3: Magazzino ────────────────────────────────────────────────────────
// Residuo = formula =D-F per riga. Riga totale: SUM per colonne numeriche.

function buildMagazzino(wb: Workbook, state: AppState): void {
  const ws = wb.addWorksheet('Magazzino');

  [6, 30, 8, 10, 10, 10, 10, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getRow(1).height = 28;
  ws.mergeCells('A1:H1');
  const t1 = ws.getCell('A1');
  t1.value = 'Magazzino';
  t1.font = { name: 'Georgia', size: 18, color: { argb: C.brassDk } };
  t1.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A2:H2');
  const s2 = ws.getCell('A2');
  s2.value = 'Giacenze: quanto resta e quanto è ancora da consegnare (solo ordini clienti)';
  s2.font = { name: 'Arial', size: 10, color: { argb: C.mute } };
  s2.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.getRow(3).height = 6;

  // Header riga 4
  ws.getRow(4).height = 20;
  const HDRS = ['Cod.', 'Prodotto', 'Peso', 'Iniziale', 'Ordinati', 'Ritirati', 'Residuo', 'Stato'];
  HDRS.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h;
    hdrCell(cell, i <= 2 ? 'left' : 'center');
  });

  const stock   = stockStatus(state);
  const prodMap = new Map(state.catalog.map((p) => [p.number, p]));
  let si = 0, so = 0, sp = 0, sr = 0;

  stock.forEach((s, i) => {
    const rn  = 5 + i;
    const odd = i % 2 === 0;
    const p   = prodMap.get(s.number);
    ws.getRow(rn).height = 18;

    si += p?.initialStock ?? 0;
    so += s.ordered;
    sp += s.pickedUp;
    sr += s.residual;

    // Colonne A-F e H (Stato) come valori; G (Residuo) come formula
    const vals: (string | number)[] = [
      s.number, p?.nameSv ?? '', p?.weight ?? '',
      p?.initialStock ?? 0, s.ordered, s.pickedUp,
    ];
    vals.forEach((v, ci) => {
      const cell = ws.getCell(rn, ci + 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell.value = v as any;
      bandCell(cell, odd);
      cell.font = { name: 'Arial', size: 10, color: { argb: C.ink } };
      cell.alignment = { horizontal: ci <= 2 ? 'left' : 'center', vertical: 'middle' };
      if (ci >= 3) cell.numFmt = FMT_INT;
    });

    // Residuo = Iniziale (D) − Ritirati (F)
    const residuoCell = ws.getCell(rn, 7);
    residuoCell.value  = fv(`D${rn}-F${rn}`, s.residual);
    residuoCell.numFmt = FMT_INT;
    bandCell(residuoCell, odd);
    residuoCell.font      = { name: 'Arial', size: 10, color: { argb: C.ink } };
    residuoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Stato chip (col H)
    const statoCell = ws.getCell(rn, 8);
    bandCell(statoCell, odd);
    if (s.delta < 0) {
      statoCell.value = `mancano ${-s.delta}`;
      chipCell(statoCell, STATE.alarm);
      addBorder(statoCell, 'bottom', 'thin', C.hairline);
      // Residuo in rosso quando prodotto scoperto
      applyFont(residuoCell, { bold: true, color: STATE.alarm.text });
    } else {
      statoCell.value = s.delta > 0 ? `coperto (+${s.delta})` : 'coperto';
      chipCell(statoCell, STATE.received);
      addBorder(statoCell, 'bottom', 'thin', C.hairline);
    }
  });

  // Riga totale con SUM
  const tn = 5 + stock.length;
  ws.getRow(tn).height = 20;
  for (let c = 1; c <= 8; c++) totCell(ws.getCell(tn, c), c === 1 ? 'left' : 'center');
  ws.getCell(tn, 1).value = 'Totale';

  const numCols: [number, number, string][] = [
    [4, si, `SUM(D5:D${tn - 1})`],
    [5, so, `SUM(E5:E${tn - 1})`],
    [6, sp, `SUM(F5:F${tn - 1})`],
    [7, sr, `SUM(G5:G${tn - 1})`],
  ];
  numCols.forEach(([c, res, formula]) => {
    const cell = ws.getCell(tn, c);
    cell.value  = fv(formula, res);
    cell.numFmt = FMT_INT;
  });

  ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  ws.autoFilter = `A4:H${tn - 1}`;
  ws.pageSetup = {
    orientation:   'landscape',
    fitToPage:     true,
    fitToWidth:    1,
    fitToHeight:   0,
    printTitlesRow: '4:4',
  };
}

// ── Sheet 4: Uso personale (itemizzato per prodotto) ──────────────────────────
// Subtotali per gruppo: SUM del gruppo. Totale finale: SUM dei subtotali.

function buildUsoPersonale(wb: Workbook, state: AppState): void {
  const ws = wb.addWorksheet('Uso personale');

  [22, 6, 30, 8, 11, 13].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const t              = totals(state);
  const personalBuyers = state.buyers.filter(isPersonal);
  const prodMap        = new Map(state.catalog.map((p) => [p.number, p]));

  ws.getRow(1).height = 28;
  ws.mergeCells('A1:F1');
  const t1 = ws.getCell('A1');
  t1.value = 'Uso personale';
  t1.font = { name: 'Georgia', size: 18, color: { argb: C.brassDk } };
  t1.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A2:F2');
  const s2 = ws.getCell('A2');
  s2.value =
    'Ordini tenuti per te, non per la vendita, con il dettaglio dei prodotti — esclusi da cassa, quadratura e giacenza.';
  s2.font = { name: 'Arial', size: 10, color: { argb: C.mute } };
  s2.alignment = { horizontal: 'left', vertical: 'middle' };

  // Riga 3: banda KPI valore totale
  ws.getRow(3).height = 26;
  for (let c = 1; c <= 6; c++) applyFill(ws.getCell(3, c), C.tint);

  ws.mergeCells('A3:D3');
  const k3 = ws.getCell('A3');
  k3.value = 'VALORE TOTALE USO PERSONALE';
  applyFill(k3, C.tint);
  k3.font = { name: 'Arial', bold: true, size: 9, color: { argb: C.brass } };
  k3.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('E3:F3');
  const kv3 = ws.getCell('E3');
  kv3.numFmt = FMT_EUR;
  applyFill(kv3, C.tint);
  kv3.font = { name: 'Georgia', bold: true, size: 14, color: { argb: C.brassDk } };
  kv3.alignment = { horizontal: 'right', vertical: 'middle' };

  ws.getRow(4).height = 6;

  // Header riga 5
  ws.getRow(5).height = 20;
  const HDRS = ['Nome', 'Cod.', 'Prodotto', 'Peso', 'Quantità', 'Valore'];
  HDRS.forEach((h, i) => {
    const cell = ws.getCell(5, i + 1);
    cell.value = h;
    hdrCell(cell, i === 0 ? 'left' : 'center');
  });

  ws.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];

  if (personalBuyers.length === 0) {
    kv3.value = t.personal; // valore statico se nessun ordine
    ws.getRow(6).height = 18;
    ws.mergeCells('A6:F6');
    const ec = ws.getCell('A6');
    ec.value = 'Nessun ordine per uso personale';
    applyFill(ec, C.white);
    ec.font = { name: 'Arial', size: 10, italic: true, color: { argb: C.mute } };
    ec.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return;
  }

  let rowNum      = 6;
  let grandPieces = 0;
  let grandValue  = 0;

  // Raccolgo i riferimenti alle celle dei subtotali per il totale finale
  const subQtyRefs: string[] = [];
  const subValRefs: string[] = [];

  personalBuyers.forEach((buyer, gi) => {
    const products = Object.entries(buyer.order)
      .filter(([, qty]) => qty > 0)
      .map(([num, qty]) => ({ num: Number(num), qty }));

    if (products.length === 0) return;

    const groupFill    = gi % 2 === 0 ? C.white : C.band;
    const groupStart   = rowNum; // prima riga dati del gruppo
    let   subPieces    = 0;
    let   subValue     = 0;
    let   first        = true;

    for (const { num, qty } of products) {
      const p = prodMap.get(num);
      const v = qty * (p?.price ?? 0);
      subPieces   += qty;
      subValue    += v;
      grandPieces += qty;
      grandValue  += v;

      ws.getRow(rowNum).height = 18;

      const nameCell = ws.getCell(rowNum, 1);
      nameCell.value = first ? buyer.name : null;
      applyFill(nameCell, groupFill);
      nameCell.font = { name: 'Arial', bold: first, size: 10, color: { argb: C.ink } };
      nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
      nameCell.border = { bottom: { style: 'thin', color: { argb: C.hairline } } };

      const rowVals: (number | string)[] = [num, p?.nameSv ?? '', p?.weight ?? '', qty, v];
      rowVals.forEach((val, ci) => {
        const cell = ws.getCell(rowNum, ci + 2);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell.value = val as any;
        applyFill(cell, groupFill);
        cell.font = { name: 'Arial', size: 10, color: { argb: C.ink } };
        cell.alignment = { horizontal: ci <= 1 ? 'left' : 'center', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: C.hairline } } };
        if (ci === 3) cell.numFmt = FMT_INT;
        if (ci === 4) cell.numFmt = FMT_EUR;
      });

      first = false;
      rowNum++;
    }

    // Riga subtotale: SUM del gruppo (groupStart..rowNum-1)
    const groupEnd = rowNum - 1;
    ws.getRow(rowNum).height = 16;
    ws.mergeCells(rowNum, 1, rowNum, 4);
    const sl = ws.getCell(rowNum, 1);
    sl.value = `Subtotale — ${buyer.name}`;
    applyFill(sl, C.band);
    sl.font = { name: 'Arial', italic: true, size: 9, color: { argb: C.mute } };
    sl.alignment = { horizontal: 'right', vertical: 'middle' };

    const sq = ws.getCell(rowNum, 5);
    sq.value  = fv(`SUM(E${groupStart}:E${groupEnd})`, subPieces);
    sq.numFmt = FMT_INT;
    applyFill(sq, C.band);
    sq.font = { name: 'Arial', italic: true, size: 9, color: { argb: C.mute } };
    sq.alignment = { horizontal: 'center', vertical: 'middle' };

    const sv = ws.getCell(rowNum, 6);
    sv.value  = fv(`SUM(F${groupStart}:F${groupEnd})`, subValue);
    sv.numFmt = FMT_EUR;
    applyFill(sv, C.band);
    sv.font = { name: 'Arial', italic: true, size: 9, color: { argb: C.mute } };
    sv.alignment = { horizontal: 'right', vertical: 'middle' };

    subQtyRefs.push(`E${rowNum}`);
    subValRefs.push(`F${rowNum}`);
    rowNum++;
  });

  // Cella E3 (KPI) referenzia la riga totale che costruiamo ora
  // Non possiamo fare una formula circolare; usiamo SUM di tutti i subtotali
  kv3.value = fv(`SUM(${subValRefs.join(',')})`, grandValue);

  // Riga totale finale: SUM dei subtotali
  ws.getRow(rowNum).height = 20;
  ws.mergeCells(rowNum, 1, rowNum, 4);
  const tl = ws.getCell(rowNum, 1);
  tl.value = 'TOTALE';
  totCell(tl, 'left');
  for (let c = 5; c <= 6; c++) addBorder(ws.getCell(rowNum, c), 'top', 'medium', C.brass);

  const tq = ws.getCell(rowNum, 5);
  tq.value  = fv(`SUM(${subQtyRefs.join(',')})`, grandPieces);
  tq.numFmt = FMT_INT;
  totCell(tq, 'center');

  const tv = ws.getCell(rowNum, 6);
  tv.value  = fv(`SUM(${subValRefs.join(',')})`, grandValue);
  tv.numFmt = FMT_EUR;
  totCell(tv, 'right');

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ── Sheet 5: Fornitore ────────────────────────────────────────────────────────
// Totale pezzi = formula =D+E per riga. Riga totale: SUM + formula D+E.

function buildFornitore(wb: Workbook, state: AppState): void {
  const ws = wb.addWorksheet('Fornitore');

  [6, 30, 8, 10, 11, 13, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getRow(1).height = 28;
  ws.mergeCells('A1:G1');
  const t1 = ws.getCell('A1');
  t1.value = 'Fornitore';
  t1.font = { name: 'Georgia', size: 18, color: { argb: C.brassDk } };
  t1.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A2:G2');
  const s2 = ws.getCell('A2');
  s2.value =
    'Totale ordinato INCLUSO uso personale — solo per far quadrare la fattura. Non incide su cassa né giacenza.';
  s2.font = { name: 'Arial', size: 10, color: { argb: C.mute } };
  s2.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.getRow(3).height = 6;

  // Header riga 4
  ws.getRow(4).height = 20;
  const HDRS = ['Cod.', 'Prodotto', 'Peso', 'Clienti', 'Personale', 'Totale pezzi', 'Valore'];
  HDRS.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h;
    hdrCell(cell, i <= 2 ? 'left' : 'center');
  });

  const ordered = orderedTotals(state);
  const prodMap = new Map(state.catalog.map((p) => [p.number, p]));

  ordered.rows.forEach((r, i) => {
    const rn  = 5 + i;
    const odd = i % 2 === 0;
    const p   = prodMap.get(r.number);
    ws.getRow(rn).height = 18;

    // Colonne A-E: Cod, Prodotto, Peso, Clienti, Personale (valori)
    const vals: (string | number)[] = [r.number, p?.nameSv ?? '', p?.weight ?? '', r.customer, r.personal];
    vals.forEach((v, ci) => {
      const cell = ws.getCell(rn, ci + 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell.value = v as any;
      bandCell(cell, odd);
      cell.font = { name: 'Arial', size: 10, color: { argb: C.ink } };
      cell.alignment = { horizontal: ci <= 2 ? 'left' : 'center', vertical: 'middle' };
      if (ci >= 3) cell.numFmt = FMT_INT;
    });

    // Totale pezzi (F) = Clienti (D) + Personale (E)
    const totPiezziCell = ws.getCell(rn, 6);
    totPiezziCell.value  = fv(`D${rn}+E${rn}`, r.total);
    totPiezziCell.numFmt = FMT_INT;
    bandCell(totPiezziCell, odd);
    totPiezziCell.font      = { name: 'Arial', size: 10, color: { argb: C.ink } };
    totPiezziCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Valore (G): pre-calcolato (total × prezzo non è in foglio)
    const valoreCell = ws.getCell(rn, 7);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valoreCell.value  = r.value as any;
    valoreCell.numFmt = FMT_EUR;
    bandCell(valoreCell, odd);
    valoreCell.font      = { name: 'Arial', size: 10, color: { argb: C.ink } };
    valoreCell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Riga totale
  const tn = 5 + ordered.rows.length;
  const customerPieces = ordered.totalPieces - ordered.personalPieces;
  ws.getRow(tn).height = 20;
  for (let c = 1; c <= 7; c++) totCell(ws.getCell(tn, c), c === 1 ? 'left' : 'center');
  ws.getCell(tn, 1).value = 'Totale';

  const totCols: [number, number, string][] = [
    [4, customerPieces,            `SUM(D5:D${tn - 1})`],
    [5, ordered.personalPieces,    `SUM(E5:E${tn - 1})`],
    [6, ordered.totalPieces,       `D${tn}+E${tn}`],
    [7, ordered.totalValue,        `SUM(G5:G${tn - 1})`],
  ];
  totCols.forEach(([c, res, formula]) => {
    const cell    = ws.getCell(tn, c);
    cell.value    = fv(formula, res);
    cell.numFmt   = c === 7 ? FMT_EUR : FMT_INT;
  });

  ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  ws.autoFilter = `A4:G${tn - 1}`;
  ws.pageSetup = {
    orientation:   'landscape',
    fitToPage:     true,
    fitToWidth:    1,
    fitToHeight:   0,
    printTitlesRow: '4:4',
  };
}

// ── Esportazione principale ───────────────────────────────────────────────────

export async function downloadRecap(state: AppState): Promise<void> {
  // ExcelJS è pesante e serve SOLO qui (export) e nell'import: import dinamico
  // così finisce in un chunk a parte, fuori dal bundle iniziale del Banco.
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'lax';
  wb.created = new Date();

  // Info per le formule cross-sheet del Riepilogo, calcolate prima di costruire i fogli
  const customerCount     = state.buyers.filter(isCustomer).length;
  const fornitoreRowCount = orderedTotals(state).rows.length;
  const ordiniLastDataRow = 4 + customerCount;       // ultima riga dati Ordini (5 + n - 1)
  const fornitoreTotal    = 5 + fornitoreRowCount;   // riga totale Fornitore

  buildRiepilogo(wb, state, ordiniLastDataRow, fornitoreTotal);
  buildOrdini(wb, state);
  buildMagazzino(wb, state);
  buildUsoPersonale(wb, state);
  buildFornitore(wb, state);

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(buf, `lax-recap-${today()}.xlsx`);
}
