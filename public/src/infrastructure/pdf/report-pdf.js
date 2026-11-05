// Informe en PDF (A4 apaisado): resumen por partido y mapa de tiros, a partir de application/report-export.
// Sincrónico, como la planilla: navigator.share tiene que llamarse dentro del mismo toque.

import { LOGO_PNG, LOGO_RATIO } from './pdf-logo.js';
import {
  drawShotCourt, drawZonesTable, drawPageFooters, COURT_SCALE, INK, MUTED, RULE, HEAD, ZEBRA, WHITE, FOOT_FILL, MARGIN
} from './pdf-renderer.js';

/** Encabezados cortos para que entren las 14 estadísticas. */
const SHORT = { pts: 'PTS', reb: 'RT', ast: 'AS', stl: 'RB', blk: 'TP', tov: 'PE', fouls: 'FC', fd: 'FR', ro: 'RO', rd: 'RD', m3: 'T3', fg: '%TC', p3: '%T3', ft: '%TL' };
const LEGEND = 'PTS puntos · RT/RO/RD rebotes totales, ofensivos y defensivos · AS asistencias · RB robos · TP tapones · PE pérdidas · FC faltas cometidas · FR faltas recibidas · T3 triples convertidos · %TC/%T3/%TL acierto en tiros de campo, triples y libres (— sin intentos).';

const num = (v) => (v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ','));

function drawHeader(doc, r, W, subtitle) {
  const LH = 7;
  try { doc.addImage(LOGO_PNG, 'PNG', MARGIN, MARGIN - 3, LH * LOGO_RATIO, LH); }
  catch (e) { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK); doc.text('SEXTO HOMBRE', MARGIN, MARGIN + 2); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
  doc.text(['Informe', r.subject, r.filtersText].filter(Boolean).join('  ·  '), W - MARGIN, MARGIN + 2, { align: 'right', maxWidth: W - 2 * MARGIN - 40 });
  doc.setDrawColor(...RULE); doc.setLineWidth(0.3); doc.line(MARGIN, MARGIN + 7, W - MARGIN, MARGIN + 7);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...INK);
  doc.text(subtitle, MARGIN, MARGIN + 17);
}

function drawGamesPage(doc, r, W) {
  drawHeader(doc, r, W, r.teamLabel + (r.subject !== 'Todo el equipo' ? '  ·  ' + r.subject : ''));
  const rec = r.record;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED);
  doc.text(r.gamesCount + (r.gamesCount === 1 ? ' partido' : ' partidos') + '  ·  ' + rec.G + ' ganados, ' + rec.P + ' perdidos' + (rec.E ? ', ' + rec.E + ' empatados' : ''), MARGIN, MARGIN + 23);
  const head = ['Fecha', 'Rival', 'Res.', ...r.stats.map((s) => SHORT[s.id] || s.label)];
  const body = r.rows.slice().reverse().map((x) => [x.dateText, x.opponent, x.result + ' ' + x.us + '-' + x.them, ...x.values.map(num)]);
  doc.autoTable({
    startY: MARGIN + 27, head: [head], body,
    foot: [['Promedio', '', '', ...r.averages.map(num)]],
    theme: 'striped', margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'helvetica', fontSize: 8.5, halign: 'center', cellPadding: 1.5, textColor: INK },
    headStyles: { fillColor: HEAD, textColor: WHITE, fontStyle: 'bold' },
    footStyles: { fillColor: FOOT_FILL, textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 20 }, 1: { halign: 'left', cellWidth: 42 }, 2: { cellWidth: 18 }, 3: { fontStyle: 'bold' } }
  });
  const y = doc.lastAutoTable.finalY + 5;
  doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
  doc.text(LEGEND, MARGIN, y, { maxWidth: W - 2 * MARGIN });
}

function drawShotsPage(doc, r, W) {
  const sc = r.shotChart;
  if (!sc.att) return;
  doc.addPage();
  drawHeader(doc, r, W, 'Mapa de tiros  ·  ' + r.subject);
  const ox = MARGIN, oy = MARGIN + 24;
  drawShotCourt(doc, sc, ox, oy);
  const p = (v) => (v == null ? '—' : num(v) + '%');
  drawZonesTable(doc, sc.zones.map((z) => [z.label, z.made + '/' + z.att, p(z.pct), p(z.share)]),
    ['Total', sc.made + '/' + sc.att, p(sc.pct), ''], ox + 1500 * COURT_SCALE + 12, oy);
}

/**
 * @param {object} r ver application/report-export buildReportExport
 * @returns {{blob: Blob, filename: string, title: string}}
 */
export function buildReportPdf(r) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setProperties({ title: r.title, creator: 'Sexto Hombre' });
  drawGamesPage(doc, r, W);
  drawShotsPage(doc, r, W);
  drawPageFooters(doc, r, W);
  return { blob: doc.output('blob'), filename: r.fileBase + '.pdf', title: r.title };
}
