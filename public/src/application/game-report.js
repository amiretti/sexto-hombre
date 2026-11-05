// Caso de uso: armar el reporte del partido que consume el generador de PDF.
// Devuelve datos planos (sin HTML, sin jsPDF).

import { DEFAULT_TEAM_COLOR, DEFAULT_OPPONENT_COLOR } from '../shared/colors.js';
import { formatDate } from '../shared/ids.js';
import { REGULAR_PERIODS, periodShort, periodLong, remainingMs, formatSeconds, overtimeCount } from '../domain/clock.js';
import {
  playerStats, ourScore, opponentScore, pointsByPeriod, isEnded, teamFouls, opponentTeamFouls, teamTurnovers, staffFouls, teamTotals, timeoutsByWindow
} from '../domain/stats.js';
import { buildShotChart } from '../domain/shot-chart.js';
import { formatMinutes } from '../domain/playing-time.js';
import { isBasicSheet } from '../domain/catalog.js';

function pctSuffix(made, att) {
  return att ? ' (' + Math.round(made * 100 / att) + '%)' : '';
}

/** "3 (1T 1U)" para la columna de faltas cometidas. */
function foulsCell(s) {
  if (!(s.tf || s.uf)) return s.fouls;
  return s.fouls + ' (' + (s.tf ? s.tf + 'T' : '') + (s.tf && s.uf ? ' ' : '') + (s.uf ? s.uf + 'U' : '') + ')';
}

/** "Unión Central 1°T 1 · 2°T 2     Rival 1°T 0 · 2°T 3". */
function timeoutsText(game) {
  const one = (team, name) => name + ' ' + timeoutsByWindow(game, team).map((w) => w.label + ' ' + w.n).join(' · ');
  return one('us', game.team) + '     ' + one('them', game.opponent);
}

function statusText(game, now) {
  if (isEnded(game, now)) {
    const ot = overtimeCount(game.period);
    return 'Final' + (ot ? ' tras ' + ot + ' suplementario' + (ot > 1 ? 's' : '') : '');
  }
  return 'En juego · ' + periodLong(game.period) + ' · ' + formatSeconds(remainingMs(game.clock, now) / 1000) + ' por jugar';
}

/** Tiros de campo del partido en media cancha y por zona (para la página del mapa). */
function shotChartReport(game) {
  const c = buildShotChart([game]);
  return {
    shots: c.shots.map((s) => ({ x: s.x, y: s.y, made: s.made })),
    zones: c.zones.filter((z) => z.att).map((z) => ({ label: z.label, cell: z.made + '/' + z.att, pct: Math.round(z.pct * 100) + '%', share: Math.round(z.share * 100) + '%' })),
    total: c.total.made + '/' + c.total.att + (c.total.att ? ' (' + Math.round(c.total.made * 100 / c.total.att) + '%)' : ''),
    att: c.total.att, unlocated: c.unlocated
  };
}

/**
 * @param {object} game
 * @param {{generatedBy?: string, now?: Date}} [opts]
 */
export function buildGameReport(game, { generatedBy = '', now = new Date() } = {}) {
  const ms = now.getTime();
  const rows = game.roster.map((p) => {
    const s = playerStats(game, p.id);
    return {
      num: p.num, name: p.name || '—', outWhy: s.outWhy, min: formatMinutes(s.sec), pts: s.pts,
      t2: s.m2 + '/' + s.a2, t3: s.m3 + '/' + s.a3, tl: s.ftm + '/' + s.fta,
      ro: s.ro, rd: s.rd, rt: s.ro + s.rd, as: s.ast, rb: s.stl, tp: s.blk, pe: s.tov, fc: foulsCell(s), fr: s.fd
    };
  });
  const T = teamTotals(game);
  const st = staffFouls(game);
  return {
    away: game.venue === 'away', team: game.team, opponent: game.opponent, category: game.category || '',
    teamLabel: game.category ? game.team + ' (' + game.category + ')' : game.team,
    teamColor: game.teamColor || DEFAULT_TEAM_COLOR, oppColor: game.oppColor || DEFAULT_OPPONENT_COLOR,
    coach: game.coach, competition: game.competition,
    stadium: game.stadium && game.stadium.name ? { name: String(game.stadium.name), location: String(game.stadium.location || '') } : null,
    date: game.date, dateText: formatDate(game.date), statusText: statusText(game, ms),
    us: ourScore(game), them: opponentScore(game),
    periods: pointsByPeriod(game).map((x) => ({ label: periodShort(x.p), us: x.us, them: x.them })),
    rows,
    totals: {
      min: formatMinutes(T.sec), pts: T.pts, t2: T.m2 + '/' + T.a2 + pctSuffix(T.m2, T.a2), t3: T.m3 + '/' + T.a3 + pctSuffix(T.m3, T.a3),
      tl: T.ftm + '/' + T.fta + pctSuffix(T.ftm, T.fta), ro: T.ro, rd: T.rd, rt: T.ro + T.rd,
      as: T.ast, rb: T.stl, tp: T.blk, pe: T.tov, fc: T.fouls, fr: T.fd
    },
    teamFoulsText: Array.from({ length: REGULAR_PERIODS }, (_, i) => periodShort(i + 1) + ' ' + teamFouls(game, i + 1)).join('   '),
    oppFoulsText: Array.from({ length: REGULAR_PERIODS }, (_, i) => periodShort(i + 1) + ' ' + opponentTeamFouls(game, i + 1)).join('   '),
    timeoutsText: timeoutsText(game),
    teamTurnovers: teamTurnovers(game),
    staffText: 'DT ' + st.c + ' técnica' + (st.c === 1 ? '' : 's') + ' · Banca ' + st.b + (st.out ? ' · DT descalificado' : ''),
    generatedAt: now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    generatedBy,
    notes: String(game.notes || ''),
    // Planilla básica: sin ubicaciones, el PDF no lleva la página del mapa de tiros.
    basic: isBasicSheet(game),
    shotChart: isBasicSheet(game) ? null : shotChartReport(game)
  };
}
