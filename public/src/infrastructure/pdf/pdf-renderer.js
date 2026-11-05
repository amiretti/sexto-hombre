// Planilla en PDF (A4 apaisado) a partir del reporte de application/game-report.
// Usa jsPDF + jsPDF-AutoTable, cargados como <script> en index.html (window.jspdf).
// Todo es sincrónico a propósito: navigator.share tiene que llamarse dentro del mismo toque del usuario.

import { LOGO_PNG, LOGO_RATIO } from './pdf-logo.js';
import { hexToRgb, isLightRgb } from '../../shared/colors.js';

const INK = [20, 25, 34], MUTED = [88, 98, 114], RULE = [210, 215, 223], HEAD = [16, 20, 26], ZEBRA = [244, 246, 249], BAD = [195, 55, 44];
const WHITE = [255, 255, 255], FOOT_FILL = [228, 232, 238], FALLBACK_COLOR = [140, 140, 140];
const MARGIN = 12;
const LEGEND = 'MIN: minutos jugados.  T2/T3/TL: convertidos/intentos (%).  RO/RD/RT: rebotes ofensivos, defensivos y totales.  AS: asistencias.  RB: robos.  TP: tapones.  PE: pérdidas.  FC: faltas cometidas.  FR: faltas recibidas.';
const BOX_HEAD = ['Nº', 'Jugador', 'MIN', 'PTS', 'T2', 'T3', 'TL', 'RO', 'RD', 'RT', 'AS', 'RB', 'TP', 'PE', 'FC', 'FR'];
const BOX_KEYS = ['min', 'pts', 't2', 't3', 'tl', 'ro', 'rd', 'rt', 'as', 'rb', 'tp', 'pe', 'fc', 'fr'];

export function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'equipo';
}

function swatch(doc, x, y, size, hex) {
  const c = hexToRgb(hex, FALLBACK_COLOR);
  doc.setFillColor(c[0], c[1], c[2]);
  if (isLightRgb(c)) { doc.setDrawColor(...MUTED); doc.setLineWidth(0.3); doc.roundedRect(x, y, size, size, 0.8, 0.8, 'FD'); }
  else doc.roundedRect(x, y, size, size, 0.8, 0.8, 'F');
}

/** Local a la izquierda, visitante a la derecha. */
function sides(r) {
  const us = { name: r.teamLabel || r.team, color: r.teamColor, score: r.us, key: 'us' };
  const them = { name: r.opponent, color: r.oppColor, score: r.them, key: 'them' };
  return r.away ? [them, us] : [us, them];
}

function drawHeader(doc, r, W) {
  const LH = 7;
  try { doc.addImage(LOGO_PNG, 'PNG', MARGIN, MARGIN - 3, LH * LOGO_RATIO, LH); }
  catch (e) { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK); doc.text('SEXTO HOMBRE', MARGIN, MARGIN + 2); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
  const metaWith = (place) => ['Planilla de juego', r.dateText, r.competition, place].filter(Boolean).join('  ·  ');
  const st = r.stadium;
  // Estadio con su ubicación si entra al lado del logo; si no, solo el nombre.
  let meta = metaWith(st && (st.location ? st.name + ' (' + st.location + ')' : st.name));
  if (st && doc.getTextWidth(meta) > W - 2 * MARGIN - 40) meta = metaWith(st.name);
  doc.text(meta, W - MARGIN, MARGIN + 2, { align: 'right' });
  doc.setDrawColor(...RULE); doc.setLineWidth(0.3); doc.line(MARGIN, MARGIN + 7, W - MARGIN, MARGIN + 7);
}

/** Dibuja el tanteador y devuelve la Y donde termina. */
function drawScoreboard(doc, r, W, L, R) {
  const cy = MARGIN + 25, cx = W / 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.setTextColor(...INK);
  const score = `${L.score}  -  ${R.score}`;
  doc.text(score, cx, cy, { align: 'center' });
  const sw = doc.getTextWidth(score);
  doc.setFontSize(15);
  const leftEdge = cx - sw / 2 - 8, rightEdge = cx + sw / 2 + 8;
  doc.text(L.name, leftEdge, cy - 1.5, { align: 'right' });
  swatch(doc, leftEdge - doc.getTextWidth(L.name) - 8, cy - 6.5, 5, L.color);
  doc.text(R.name, rightEdge, cy - 1.5);
  swatch(doc, rightEdge + doc.getTextWidth(R.name) + 3, cy - 6.5, 5, R.color);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...MUTED);
  doc.text(r.statusText, cx, cy + 8, { align: 'center' });
  if (r.coach) { doc.setFontSize(9); doc.text(`DT ${r.team}: ${r.coach}`, cx, cy + 13, { align: 'center' }); }
  return cy + 18;
}

function drawPeriodsTable(doc, r, W, L, R, startY) {
  const head = ['Equipo', ...r.periods.map((p) => p.label), 'Total'];
  const body = [
    [L.name, ...r.periods.map((p) => p[L.key]), L.score],
    [R.name, ...r.periods.map((p) => p[R.key]), R.score]
  ];
  const width = Math.min(W - 2 * MARGIN, 60 + r.periods.length * 16 + 18);
  doc.autoTable({
    startY, head: [head], body, theme: 'grid',
    margin: { left: (W - width) / 2, right: (W - width) / 2 }, tableWidth: width,
    styles: { font: 'helvetica', fontSize: 9.5, halign: 'center', cellPadding: 1.6, textColor: INK, lineColor: RULE, lineWidth: 0.2 },
    headStyles: { fillColor: HEAD, textColor: WHITE, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 60 }, [head.length - 1]: { fontStyle: 'bold' } }
  });
}

function drawBoxScore(doc, r) {
  const body = r.rows.map((x) => [x.num, x.name + (x.outWhy ? `  (${x.outWhy})` : ''), ...BOX_KEYS.map((k) => x[k])]);
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 7, head: [BOX_HEAD], body,
    foot: [['', 'Equipo', ...BOX_KEYS.map((k) => r.totals[k])]],
    theme: 'striped', margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'helvetica', fontSize: 9, halign: 'center', cellPadding: 1.7, textColor: INK },
    headStyles: { fillColor: HEAD, textColor: WHITE, fontStyle: 'bold' },
    footStyles: { fillColor: FOOT_FILL, textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 11 }, 1: { halign: 'left', cellWidth: 56 }, 3: { fontStyle: 'bold' } },
    didParseCell: (d) => {
      if (d.section === 'body' && r.rows[d.row.index] && r.rows[d.row.index].outWhy && d.column.index === 1) d.cell.styles.textColor = BAD;
    }
  });
}

function drawFoulsAndLegend(doc, r, W) {
  let y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(9); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold');
  doc.text('Faltas de equipo:', MARGIN, y);
  doc.setFont('helvetica', 'normal'); doc.text(r.teamFoulsText, MARGIN + 29, y);
  doc.setFont('helvetica', 'bold'); doc.text('Cuerpo técnico:', W / 2, y);
  doc.setFont('helvetica', 'normal'); doc.text(r.staffText, W / 2 + 27, y);
  if (r.oppFoulsText) {
    y += 5;
    doc.setFont('helvetica', 'bold'); doc.text('Faltas del rival:', MARGIN, y);
    doc.setFont('helvetica', 'normal'); doc.text(r.oppFoulsText, MARGIN + 29, y);
  }
  if (r.teamTurnovers) {
    y += 5;
    doc.setFont('helvetica', 'bold'); doc.text('Pérdidas de equipo:', MARGIN, y);
    doc.setFont('helvetica', 'normal'); doc.text(r.teamTurnovers + ' (24 s / 8 s, sin jugador; suman en la fila Equipo)', MARGIN + 33, y);
  }
  if (r.timeoutsText) {
    y += 5;
    doc.setFont('helvetica', 'bold'); doc.text('Tiempos muertos:', MARGIN, y);
    doc.setFont('helvetica', 'normal'); doc.text(r.timeoutsText, MARGIN + 29, y);
  }
  y += 5;
  doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  doc.text(LEGEND, MARGIN, y, { maxWidth: W - 2 * MARGIN });
}

const GOOD = [22, 131, 74], COURT_LINE = [120, 128, 140];

/** Página con los tiros de campo en media cancha (aro arriba) y la tabla por zona. */
function drawShotChartPage(doc, r, W) {
  const sc = r.shotChart;
  if (!sc || !sc.att) return;
  doc.addPage();
  drawHeader(doc, r, W);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...INK);
  doc.text('Mapa de tiros  ·  ' + (r.teamLabel || r.team), MARGIN, MARGIN + 17);
  const ox = MARGIN, oy = MARGIN + 24;
  drawShotCourt(doc, sc, ox, oy);
  drawZonesTable(doc, sc.zones.map((z) => [z.label, z.cell, z.pct, z.share]), ['Total', sc.total, '', ''], ox + 1500 * COURT_SCALE + 12, oy);
}

/** 1 cm de cancha = 0,1 mm: la media cancha ocupa 150 × 140 mm. */
export const COURT_SCALE = 0.1;

/**
 * Media cancha (aro arriba) con los tiros y la leyenda debajo.
 * @param {{shots: {x, y, made}[], unlocated: number}} sc
 */
export function drawShotCourt(doc, sc, ox, oy) {
  const s = COURT_SCALE;
  const P = (x, y) => [ox + (1500 - y) * s, oy + x * s];
  const seg = (a, b) => { const p = P(...a), q = P(...b); doc.line(p[0], p[1], q[0], q[1]); };
  doc.setDrawColor(...COURT_LINE); doc.setLineWidth(0.4);
  doc.rect(ox, oy, 1500 * s, 1400 * s);
  doc.rect(...P(0, 995), 490 * s, 580 * s);
  const arc = (cx, cy, rad, from, to) => {
    let prev = null;
    for (let a = from; a <= to + 0.001; a += (to - from) / 40) {
      const pt = [cx + rad * Math.cos(a * Math.PI / 180), cy + rad * Math.sin(a * Math.PI / 180)];
      if (prev) seg(prev, pt);
      prev = pt;
    }
  };
  seg([0, 90], [299, 90]); seg([0, 1410], [299, 1410]);
  const a3 = Math.asin(660 / 675) * 180 / Math.PI;
  arc(157.5, 750, 675, -a3, a3);
  arc(580, 750, 180, -90, 90);
  arc(1400, 750, 180, 90, 270);
  doc.setDrawColor(...INK); doc.setLineWidth(0.8); seg([120, 660], [120, 840]);
  doc.setDrawColor(...BAD); doc.setLineWidth(0.5); doc.circle(...P(157.5, 750), 22.5 * s);
  sc.shots.forEach((sh) => {
    const [x, y] = P(Math.min(sh.x, 1400), sh.y);
    if (sh.made) { doc.setFillColor(...GOOD); doc.circle(x, y, 1.6, 'F'); }
    else { doc.setDrawColor(...BAD); doc.setLineWidth(0.6); doc.line(x - 1.4, y - 1.4, x + 1.4, y + 1.4); doc.line(x - 1.4, y + 1.4, x + 1.4, y - 1.4); }
  });
  const ly = oy + 1400 * s + 6;
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
  doc.setFillColor(...GOOD); doc.circle(ox + 2, ly - 1, 1.4, 'F'); doc.text('Convertido', ox + 5, ly);
  doc.setDrawColor(...BAD); doc.line(ox + 27, ly - 2.2, ox + 29.4, ly + 0.2); doc.line(ox + 27, ly + 0.2, ox + 29.4, ly - 2.2); doc.text('Errado', ox + 32, ly);
  if (sc.unlocated) doc.text((sc.unlocated === 1 ? '1 tiro sin ubicación (cuenta' : sc.unlocated + ' tiros sin ubicación (cuentan') + ' en el total).', ox + 50, ly);
}

/** Tabla de tiros por zona a la derecha de la cancha. */
export function drawZonesTable(doc, body, foot, tx, oy) {
  doc.autoTable({
    startY: oy, head: [['Zona', 'Conv./Int.', 'Acierto', 'De los tiros']],
    body,
    foot: [foot],
    theme: 'striped', margin: { left: tx, right: MARGIN },
    styles: { font: 'helvetica', fontSize: 9, halign: 'center', cellPadding: 1.7, textColor: INK },
    headStyles: { fillColor: HEAD, textColor: WHITE, fontStyle: 'bold' },
    footStyles: { fillColor: FOOT_FILL, textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { halign: 'left' } }
  });
}

export function drawPageFooters(doc, r, W) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`Generado el ${r.generatedAt}${r.generatedBy ? ' por ' + r.generatedBy : ''}`, MARGIN, H - 7);
    doc.text(`Página ${i} de ${pages}`, W - MARGIN, H - 7, { align: 'right' });
  }
}

/**
 * @param {object} r reporte (ver application/game-report buildGameReport)
 * @returns {{blob: Blob, filename: string, title: string}}
 */
export function buildPdf(r) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setProperties({ title: r.away ? `Planilla ${r.opponent} vs ${r.team}` : `Planilla ${r.team} vs ${r.opponent}`, creator: 'Sexto Hombre' });
  const [L, R] = sides(r);

  drawHeader(doc, r, W);
  const y = drawScoreboard(doc, r, W, L, R);
  drawPeriodsTable(doc, r, W, L, R, y);
  drawBoxScore(doc, r);
  drawFoulsAndLegend(doc, r, W);
  drawShotChartPage(doc, r, W);
  drawPageFooters(doc, r, W);

  const filename = `Planilla_${slug(L.name)}-vs-${slug(R.name)}_${r.date || 'partido'}.pdf`;
  return { blob: doc.output('blob'), filename, title: `${L.name} ${L.score} - ${R.score} ${R.name}` };
}

/** Paleta y margen compartidos con el PDF del informe. */
export { INK, MUTED, RULE, HEAD, ZEBRA, WHITE, FOOT_FILL, MARGIN };
