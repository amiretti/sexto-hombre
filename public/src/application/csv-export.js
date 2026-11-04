// Caso de uso: exportar el historial y la planilla como CSV.

import { EVENT_LABELS } from '../domain/catalog.js';
import { periodShort, formatSeconds } from '../domain/clock.js';
import { zoneName } from '../domain/court.js';
import { playerStats, eventPoints, eventsChronological } from '../domain/stats.js';
import { findPlayer, eventDetail, eventActor } from '../domain/describe.js';

/** Texto que una planilla de cálculo interpretaría como fórmula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (typeof v !== 'number' && FORMULA_START.test(s)) s = "'" + s;
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function historyCsv(game) {
  const rows = [['Periodo', 'Tiempo', 'Numero', 'Jugador', 'Accion', 'Detalle', 'Puntos', 'Zona', 'X_cm', 'Y_cm']];
  eventsChronological(game).forEach((e) => {
    const p = findPlayer(game, e.who);
    rows.push([
      periodShort(e.period), formatSeconds(e.t), p ? p.num : '', e.type === 'SUB' ? '' : eventActor(game, e, true),
      EVENT_LABELS[e.type], eventDetail(game, e), eventPoints(e), e.x != null ? zoneName(e.x, e.y) : '',
      e.x == null ? '' : e.x, e.y == null ? '' : e.y
    ]);
  });
  return toCsv(rows);
}

export function boxScoreCsv(game) {
  const rows = [['Numero', 'Jugador', 'PTS', 'T2C', 'T2I', 'T3C', 'T3I', 'TLC', 'TLI', 'RO', 'RD', 'AS', 'RB', 'TP', 'PE', 'FC', 'FR']];
  game.roster.forEach((p) => {
    const s = playerStats(game, p.id);
    rows.push([p.num, p.name, s.pts, s.m2, s.a2, s.m3, s.a3, s.ftm, s.fta, s.ro, s.rd, s.ast, s.stl, s.blk, s.tov, s.fouls, s.fd]);
  });
  return toCsv(rows);
}
