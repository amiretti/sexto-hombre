// Caso de uso: datos del informe listos para exportar (PDF y Excel), con los filtros aplicados.

import { formatDate } from '../shared/ids.js';
import { ourScore, opponentScore } from '../domain/stats.js';
import { buildShotChart } from '../domain/shot-chart.js';
import { PROGRESS_STATS, playerSeries, chronological } from '../domain/player-progress.js';

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const pct = (made, att) => (att ? Math.round(made * 1000 / att) / 10 : null);

function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'informe';
}

/**
 * @param {object[]} games partidos con `events` y `roster` (los del informe)
 * @param {{playerId?: string}} f filtros
 * @param {{teamLabel: string, playerLabel?: string, filtersText?: string, generatedBy?: string, now?: Date}} meta
 */
export function buildReportExport(games, f, meta) {
  const playerId = f.playerId || null;
  const now = meta.now || new Date();
  const series = PROGRESS_STATS.map((s) => playerSeries(games, playerId, s.id));
  const byId = new Map(chronological(games).map((g) => [g.id, g]));
  // Partidos en los que el jugador fue convocado (todos, si es el equipo), del más viejo al más nuevo.
  const rows = series[0].points.map((p, i) => {
    const g = byId.get(p.gameId) || {};
    const us = ourScore(g), them = opponentScore(g);
    return {
      date: p.date, dateText: formatDate(p.date), opponent: p.opponent, competition: g.competition || '',
      result: us > them ? 'G' : us < them ? 'P' : 'E', us, them,
      values: series.map((s) => s.points[i].value), details: series.map((s) => s.points[i].detail)
    };
  });
  const chart = buildShotChart(games, { playerId });
  const located = chart.total.att - chart.unlocated;
  const zones = chart.zones.filter((z) => z.att).map((z) => ({
    label: z.label, made: z.made, att: z.att, pct: pct(z.made, z.att), share: located ? round1(z.att * 100 / located) : null
  }));
  const subject = playerId ? (meta.playerLabel || 'Jugador') : 'Todo el equipo';
  const fileBase = 'Informe_' + slug(meta.teamLabel) + (playerId ? '_' + slug(meta.playerLabel) : '') + '_' + now.toISOString().slice(0, 10);
  return {
    title: 'Informe · ' + meta.teamLabel,
    teamLabel: meta.teamLabel, subject, filtersText: meta.filtersText || '',
    gamesCount: rows.length,
    stats: PROGRESS_STATS.map((s) => ({ id: s.id, label: s.label, pct: !!s.pct })),
    rows,
    averages: series.map((s) => s.average),
    record: rows.reduce((a, r) => { a[r.result]++; return a; }, { G: 0, P: 0, E: 0 }),
    shotChart: {
      shots: chart.shots.map((s) => ({ x: s.x, y: s.y, made: s.made })),
      zones, made: chart.total.made, att: chart.total.att, pct: pct(chart.total.made, chart.total.att), unlocated: chart.unlocated
    },
    generatedAt: now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    generatedBy: meta.generatedBy || '',
    fileBase
  };
}

/** Hojas del Excel: por partido y tiros por zona (números como números). */
export function reportSheets(r) {
  const head = (cells) => cells.map((v) => ({ v, bold: true }));
  const info = [[{ v: r.title, bold: true }], [r.subject + (r.filtersText ? ' · ' + r.filtersText : '')], ['Generado el ' + r.generatedAt + (r.generatedBy ? ' por ' + r.generatedBy : '')], []];
  const statHead = r.stats.map((s) => s.label);
  const games = {
    name: 'Por partido',
    widths: [12, 24, 22, 8, 10, 10, ...r.stats.map(() => 12)],
    rows: [...info, head(['Fecha', 'Rival', 'Competición', 'Resultado', 'Puntos a favor', 'Puntos en contra', ...statHead]),
      ...r.rows.slice().reverse().map((x) => [x.dateText, x.opponent, x.competition, x.result, x.us, x.them, ...x.values]),
      head(['Promedio', '', '', '', '', '', ...r.averages])]
  };
  const sc = r.shotChart;
  const zones = {
    name: 'Tiros por zona',
    widths: [30, 12, 12, 12, 14],
    rows: [...info, head(['Zona', 'Convertidos', 'Intentos', '% acierto', '% de los tiros']),
      ...sc.zones.map((z) => [z.label, z.made, z.att, z.pct, z.share]),
      head(['Total', sc.made, sc.att, sc.pct, '']),
      ...(sc.unlocated ? [[], [sc.unlocated + ' tiros sin ubicación: cuentan en el total pero no en las zonas.']] : [])]
  };
  return [games, zones];
}
