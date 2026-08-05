import { Workbook } from 'exceljs';
import type { Cell, Fill } from 'exceljs';
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

function solid(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

// ── Cell style primitives ─────────────────────────────────────────────────────

function applyFill(cell: Cell, argb: string): void {
  cell.fill = solid(argb);
}

function applyFont(
  cell: Cell,
  opts: {
    name?: string; size?: number; bold?: boolean;
    italic?: boolean; color?: string;
  },
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

function buildRiepilogo(wb: Workbook, state: AppState): void {
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

  // 6 schede KPI
  const CARDS = [
    { label: 'CONTANTI IN CASSA',        value: t.cash,        fmt: FMT_EUR, s: STATE.cash },
    { label: 'BONIFICI RICEVUTI',         value: t.received,    fmt: FMT_EUR, s: STATE.received },
    { label: 'BONIFICI ATTESI',           value: t.pending,     fmt: FMT_EUR, s: STATE.pending },
    { label: 'RITIRATO, NON PAGATO',      value: t.unpaid,      fmt: FMT_EUR, s: STATE.alarm },
    { label: 'DEVONO RITIRARE (valore)',  value: t.toPickValue, fmt: FMT_EUR, s: STATE.neutral },
    { label: 'DEVONO RITIRARE (persone)', value: t.toPickCount, fmt: FMT_INT, s: STATE.neutral },
  ] as const;

  const cardBaseRows = [6, 10, 14] as const;
  const cardColPairs  = [[2, 3], [5, 6]] as const;

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

    // Valore (2 righe unite)
    ws.mergeCells(baseRow + 1, sc, baseRow + 2, ec);
    const vc = ws.getCell(baseRow + 1, sc);
    vc.value = card.value;
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

  // Riga 18: esito quadratura
  ws.getRow(18).height = 22;
  ws.mergeCells('B18:F18');
  const quadCell = ws.getCell('B18');
  const balanced = isBalanced(state);
  const pickedVal = pickedUpValue(t);
  if (balanced) {
    quadCell.value = '✓  I conti quadrano';
    applyFill(quadCell, STATE.received.fill);
    quadCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: STATE.received.text } };
  } else {
    quadCell.value = '⚠  Conti da verificare';
    applyFill(quadCell, STATE.alarm.fill);
    quadCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: STATE.alarm.text } };
  }
  quadCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Riga 19: formula testuale quadratura
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

  ws.mergeCells('B23:D23');
  const reco1 = ws.getCell('B23');
  reco1.value = `${ordered.totalPieces} pezzi in totale`;
  applyFill(reco1, C.tint);
  reco1.font = { name: 'Arial', bold: true, size: 10, color: { argb: C.brassDk } };
  reco1.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('E23:F23');
  const reco2 = ws.getCell('E23');
  reco2.value = ordered.totalValue;
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
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: 'A1:F27',
  };
}

// ── Sheet 2: Ordini ───────────────────────────────────────────────────────────

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
    const pagState = !buyer.pickedUp        ? STATE.neutral
      : buyer.payment === 'cash'            ? STATE.cash
      : buyer.payment === 'received'        ? STATE.received
      : buyer.payment === 'pending'         ? STATE.pending
      : STATE.alarm;
    chipCell(ws.getCell(rn, 6), pagState);
    addBorder(ws.getCell(rn, 6), 'bottom', 'thin', C.hairline);
  });

  // Riga totale
  const tn = 5 + customers.length;
  ws.getRow(tn).height = 20;
  for (let c = 1; c <= 6; c++) totCell(ws.getCell(tn, c), c === 1 ? 'left' : 'right');
  ws.getCell(tn, 1).value = 'Totale';
  ws.getCell(tn, 3).value = sumPieces;
  ws.getCell(tn, 3).numFmt = FMT_INT;
  ws.getCell(tn, 4).value = sumValue;
  ws.getCell(tn, 4).numFmt = FMT_EUR;

  ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  ws.autoFilter = `A4:F${tn - 1}`;
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '4:4',
  };
}

// ── Sheet 3: Magazzino ────────────────────────────────────────────────────────

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

    const vals: (string | number)[] = [
      s.number, p?.nameSv ?? '', p?.weight ?? '',
      p?.initialStock ?? 0, s.ordered, s.pickedUp, s.residual, '',
    ];
    vals.forEach((v, ci) => {
      const cell = ws.getCell(rn, ci + 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell.value = v as any;
      bandCell(cell, odd);
      cell.font = { name: 'Arial', size: 10, color: { argb: C.ink } };
      cell.alignment = { horizontal: ci <= 2 ? 'left' : 'center', vertical: 'middle' };
      if (ci >= 3 && ci <= 6) cell.numFmt = FMT_INT;
    });

    // Chip Stato
    const statoCell = ws.getCell(rn, 8);
    if (s.delta < 0) {
      statoCell.value = `mancano ${-s.delta}`;
      chipCell(statoCell, STATE.alarm);
      addBorder(statoCell, 'bottom', 'thin', C.hairline);
      // Residuo in rosso
      applyFont(ws.getCell(rn, 7), { bold: true, color: STATE.alarm.text });
    } else {
      statoCell.value = s.delta > 0 ? `coperto (+${s.delta})` : 'coperto';
      chipCell(statoCell, STATE.received);
      addBorder(statoCell, 'bottom', 'thin', C.hairline);
    }
  });

  // Riga totale
  const tn = 5 + stock.length;
  ws.getRow(tn).height = 20;
  for (let c = 1; c <= 8; c++) totCell(ws.getCell(tn, c), c === 1 ? 'left' : 'center');
  ws.getCell(tn, 1).value = 'Totale';
  ws.getCell(tn, 4).value = si; ws.getCell(tn, 4).numFmt = FMT_INT;
  ws.getCell(tn, 5).value = so; ws.getCell(tn, 5).numFmt = FMT_INT;
  ws.getCell(tn, 6).value = sp; ws.getCell(tn, 6).numFmt = FMT_INT;
  ws.getCell(tn, 7).value = sr; ws.getCell(tn, 7).numFmt = FMT_INT;

  ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  ws.autoFilter = `A4:H${tn - 1}`;
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '4:4',
  };
}

// ── Sheet 4: Uso personale (itemizzato per prodotto) ──────────────────────────

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
  kv3.value = t.personal;
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

  let rowNum     = 6;
  let grandPieces = 0;
  let grandValue  = 0;

  personalBuyers.forEach((buyer, gi) => {
    const products = Object.entries(buyer.order)
      .filter(([, qty]) => qty > 0)
      .map(([num, qty]) => ({ num: Number(num), qty }));

    if (products.length === 0) return;

    const groupFill = gi % 2 === 0 ? C.white : C.band;
    let subPieces = 0;
    let subValue  = 0;
    let first = true;

    for (const { num, qty } of products) {
      const p = prodMap.get(num);
      const v = qty * (p?.price ?? 0);
      subPieces   += qty;
      subValue    += v;
      grandPieces += qty;
      grandValue  += v;

      ws.getRow(rowNum).height = 18;

      // Colonna A: nome (solo prima riga del gruppo)
      const nameCell = ws.getCell(rowNum, 1);
      nameCell.value = first ? buyer.name : null;
      applyFill(nameCell, groupFill);
      nameCell.font = { name: 'Arial', bold: first, size: 10, color: { argb: C.ink } };
      nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
      nameCell.border = { bottom: { style: 'thin', color: { argb: C.hairline } } };

      // Colonne B-F: cod, prodotto, peso, quantità, valore
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

    // Riga subtotale
    ws.getRow(rowNum).height = 16;
    ws.mergeCells(rowNum, 1, rowNum, 4);
    const sl = ws.getCell(rowNum, 1);
    sl.value = `Subtotale — ${buyer.name}`;
    applyFill(sl, C.band);
    sl.font = { name: 'Arial', italic: true, size: 9, color: { argb: C.mute } };
    sl.alignment = { horizontal: 'right', vertical: 'middle' };

    const sq = ws.getCell(rowNum, 5);
    sq.value = subPieces;
    sq.numFmt = FMT_INT;
    applyFill(sq, C.band);
    sq.font = { name: 'Arial', italic: true, size: 9, color: { argb: C.mute } };
    sq.alignment = { horizontal: 'center', vertical: 'middle' };

    const sv = ws.getCell(rowNum, 6);
    sv.value = subValue;
    sv.numFmt = FMT_EUR;
    applyFill(sv, C.band);
    sv.font = { name: 'Arial', italic: true, size: 9, color: { argb: C.mute } };
    sv.alignment = { horizontal: 'right', vertical: 'middle' };

    rowNum++;
  });

  // Riga totale complessivo
  ws.getRow(rowNum).height = 20;
  ws.mergeCells(rowNum, 1, rowNum, 4);
  const tl = ws.getCell(rowNum, 1);
  tl.value = 'TOTALE';
  totCell(tl, 'left');
  // Applica bordo superiore alle celle non-master della riga totale
  for (let c = 5; c <= 6; c++) addBorder(ws.getCell(rowNum, c), 'top', 'medium', C.brass);

  const tq = ws.getCell(rowNum, 5);
  tq.value = grandPieces;
  tq.numFmt = FMT_INT;
  totCell(tq, 'center');

  const tv = ws.getCell(rowNum, 6);
  tv.value = grandValue;
  tv.numFmt = FMT_EUR;
  totCell(tv, 'right');

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ── Sheet 5: Fornitore ────────────────────────────────────────────────────────

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

    const vals: (string | number)[] = [
      r.number, p?.nameSv ?? '', p?.weight ?? '',
      r.customer, r.personal, r.total, r.value,
    ];
    vals.forEach((v, ci) => {
      const cell = ws.getCell(rn, ci + 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell.value = v as any;
      bandCell(cell, odd);
      cell.font = { name: 'Arial', size: 10, color: { argb: C.ink } };
      cell.alignment = { horizontal: ci <= 2 ? 'left' : 'center', vertical: 'middle' };
      if (ci >= 3 && ci <= 5) cell.numFmt = FMT_INT;
      if (ci === 6) cell.numFmt = FMT_EUR;
    });
  });

  // Riga totale
  const tn = 5 + ordered.rows.length;
  ws.getRow(tn).height = 20;
  for (let c = 1; c <= 7; c++) totCell(ws.getCell(tn, c), c === 1 ? 'left' : 'center');
  ws.getCell(tn, 1).value = 'Totale';
  ws.getCell(tn, 4).value = ordered.totalPieces - ordered.personalPieces;
  ws.getCell(tn, 4).numFmt = FMT_INT;
  ws.getCell(tn, 5).value = ordered.personalPieces;
  ws.getCell(tn, 5).numFmt = FMT_INT;
  ws.getCell(tn, 6).value = ordered.totalPieces;
  ws.getCell(tn, 6).numFmt = FMT_INT;
  ws.getCell(tn, 7).value = ordered.totalValue;
  ws.getCell(tn, 7).numFmt = FMT_EUR;

  ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  ws.autoFilter = `A4:G${tn - 1}`;
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '4:4',
  };
}

// ── Esportazione principale ───────────────────────────────────────────────────

export async function downloadRecap(state: AppState): Promise<void> {
  const wb = new Workbook();
  wb.creator = 'lax';
  wb.created = new Date();

  buildRiepilogo(wb, state);
  buildOrdini(wb, state);
  buildMagazzino(wb, state);
  buildUsoPersonale(wb, state);
  buildFornitore(wb, state);

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(buf, `lax-recap-${today()}.xlsx`);
}
