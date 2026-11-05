// Gráficos de los informes en SVG propio (sin librerías: la app funciona sin conexión).

import { esc } from '../../shared/html.js';
import { formatDate } from '../../shared/ids.js';
import { HALF_LENGTH, HOOP, MIN_ATTEMPTS_FOR_PCT, INSIDE_ARC_PATH, ZONE_SHAPES, ZONE_LABEL_AT } from '../../domain/shot-chart.js';

const pctText = (p) => (p == null ? '—' : Math.round(p * 100) + '%');

/** Clase de color de la zona: volumen (secuencial) o rendimiento (divergente alrededor de 1 punto por tiro). */
export function zoneClass(z, mode, maxAtt) {
  if (!z.att) return 'z-none';
  if (mode === 'volume') return 'z-v' + Math.max(1, Math.ceil(z.att / maxAtt * 5));
  if (z.att < MIN_ATTEMPTS_FOR_PCT) return 'z-few';
  const p = z.pps;
  if (p < 0.6) return 'z-dn2';
  if (p < 0.85) return 'z-dn1';
  if (p <= 1.15) return 'z-d0';
  if (p <= 1.4) return 'z-dp1';
  return 'z-dp2';
}

/** Texto completo de una zona (tooltip y lectores de pantalla). */
export function zoneSummary(z) {
  if (!z.att) return z.label + ': sin tiros';
  return z.label + ': ' + z.made + '/' + z.att + ' (' + pctText(z.pct) + '), ' + Math.round(z.share * 100) + '% de los tiros';
}

/** Rótulo corto dentro de la zona. */
function zoneLabel(z, mode) {
  if (!z.att) return '';
  if (mode === 'volume') return String(z.att);
  return z.att < MIN_ATTEMPTS_FOR_PCT ? z.made + '/' + z.att : pctText(z.pct);
}

/** Del marco normalizado (aro en x = 0) a la pantalla con el aro arriba. */
const toScreen = (x, y) => [1500 - y, x];

const COURT_LINES = '<g class="sc-lines">' +
  '<rect x="0" y="0" width="' + HALF_LENGTH + '" height="1500"/>' +
  '<rect x="0" y="505" width="580" height="490"/>' +
  '<path d="M580 570A180 180 0 0 1 580 930"/>' +
  '<path d="' + INSIDE_ARC_PATH.replace(/Z$/, '') + '"/>' +
  '<path d="M' + HALF_LENGTH + ' 570A180 180 0 0 0 ' + HALF_LENGTH + ' 930"/>' +
  '<path d="M157.5 625A125 125 0 0 1 157.5 875"/>' +
  '</g><line class="sc-board" x1="120" y1="660" x2="120" y2="840"/><circle class="sc-hoop" cx="' + HOOP.x + '" cy="' + HOOP.y + '" r="22.5"/>';

/**
 * Media cancha con las zonas coloreadas (aro arriba).
 * @param {{zones: object[]}} chart resultado de buildShotChart
 * @param {'volume'|'pct'} mode
 */
export function shotChartSVG(chart, mode) {
  const byId = Object.fromEntries(chart.zones.map((z) => [z.id, z]));
  const maxAtt = Math.max(1, ...chart.zones.filter((z) => z.id !== 'back').map((z) => z.att));
  const zones = ZONE_SHAPES.map((s) => {
    const z = byId[s.id];
    const clip = s.clip === 'inside' ? ' clip-path="url(#sc-in)"' : s.clip === 'outside' ? ' mask="url(#sc-out)"' : '';
    return '<path class="zone ' + zoneClass(z, mode, maxAtt) + '" d="' + s.d + '"' + clip + '><title>' + esc(zoneSummary(z)) + '</title></path>';
  }).join('');
  const labels = Object.keys(ZONE_LABEL_AT).map((id) => {
    const text = zoneLabel(byId[id], mode);
    if (!text) return '';
    const [sx, sy] = toScreen(...ZONE_LABEL_AT[id]);
    return '<text x="' + sx + '" y="' + sy + '">' + esc(text) + '</text>';
  }).join('');
  return '<svg class="shotchart" viewBox="-20 -20 1540 1440" role="img" aria-labelledby="sc-title">' +
    '<title id="sc-title">' + (mode === 'volume' ? 'Mapa de tiros por volumen' : 'Mapa de tiros por acierto') + '. El detalle por zona está en la tabla.</title>' +
    '<defs><clipPath id="sc-in"><path d="' + INSIDE_ARC_PATH + '"/></clipPath>' +
    '<mask id="sc-out" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1700" height="1700"><rect x="-100" y="-100" width="1700" height="1700" fill="#fff"/><path d="' + INSIDE_ARC_PATH + '" fill="#000"/></mask>' +
    '<clipPath id="sc-half"><rect x="0" y="0" width="' + HALF_LENGTH + '" height="1500"/></clipPath>' +
    '<pattern id="sc-hatch" patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="rotate(45)"><rect width="40" height="40" class="z-hatch-bg"/><line x1="0" y1="0" x2="0" y2="40" class="z-hatch"/></pattern></defs>' +
    '<g transform="matrix(0 1 -1 0 1500 0)"><g clip-path="url(#sc-half)">' + zones + '</g>' + COURT_LINES + '</g>' +
    '<g class="sc-labels" aria-hidden="true">' + labels + '</g></svg>';
}

/* ---------- gráfico de línea ---------- */

function niceMax(v) {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}

function ticks(max) {
  const n = 4, out = [];
  for (let i = 0; i <= n; i++) out.push(Math.round(max * i / n * 10) / 10);
  return out;
}

/** Número con coma decimal (es-AR): 36,7 */
export const decimal = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const fmt = (v, pct) => (v == null ? '—' : decimal(v) + (pct ? '%' : ''));

/** Texto de un punto (tooltip y tabla). */
export function pointSummary(p, stat) {
  return formatDate(p.date) + ' vs ' + (p.opponent || 'rival') + ': ' + fmt(p.value, stat.pct) + (p.detail ? ' (' + p.detail + ')' : '');
}

/**
 * Línea con un punto por partido y el promedio punteado.
 * @param {{stat, points, average}} series resultado de playerSeries
 */
export function lineChartSVG(series) {
  const { stat, points, average } = series;
  const W = 640, H = 260, L = 44, R = 16, T = 16, B = 40;
  const values = points.map((p) => p.value).filter((v) => v != null);
  const max = stat.pct ? 100 : niceMax(Math.max(0, ...values));
  const n = points.length;
  const x = (i) => (n === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);

  const grid = ticks(max).map((t) => '<line class="lc-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>' +
    '<text class="lc-tick" x="' + (L - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + decimal(t) + (stat.pct ? '%' : '') + '</text>').join('');
  const every = Math.max(1, Math.ceil(n / 8));
  const xLabels = points.map((p, i) => (i % every && i !== n - 1 ? '' :
    '<text class="lc-tick" x="' + x(i) + '" y="' + (H - B + 18) + '" text-anchor="middle">' + esc(formatDate(p.date).slice(0, 5)) + '</text>')).join('');

  // La línea se corta donde no hay dato (p. ej. un % sin intentos).
  let path = '', open = false;
  points.forEach((p, i) => {
    if (p.value == null) { open = false; return; }
    path += (open ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1);
    open = true;
  });
  const avg = average == null ? '' :
    '<line class="lc-avg" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(average) + '" y2="' + y(average) + '"/>' +
    '<text class="lc-avgt" x="' + (W - R) + '" y="' + (y(average) - 6) + '" text-anchor="end">Promedio ' + fmt(average, stat.pct) + '</text>';
  const marks = points.map((p, i) => (p.value == null ? '' :
    '<g class="lc-pt"><circle class="lc-hit" cx="' + x(i) + '" cy="' + y(p.value) + '" r="14"/><circle class="lc-dot" cx="' + x(i) + '" cy="' + y(p.value) + '" r="5"/>' +
    '<title>' + esc(pointSummary(p, stat)) + '</title></g>')).join('');

  return '<svg class="linechart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="lc-title">' +
    '<title id="lc-title">' + esc(stat.label) + ' por partido. Los valores están en la tabla.</title>' +
    grid + '<line class="lc-axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>' + xLabels +
    avg + '<path class="lc-line" d="' + path + '"/>' + marks + '</svg>';
}
