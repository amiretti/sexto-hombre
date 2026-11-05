// Estadísticas derivadas de las jugadas. Funciones puras sobre `game` (no mutan).

import { isFoul, isStaff, COACH, BENCH } from './catalog.js';
import { REGULAR_PERIODS, remainingMs } from './clock.js';
import { playingTime } from './playing-time.js';

/** Puntos que suma una jugada a nuestro equipo. */
export function eventPoints(e) {
  if (e.type === '2M') return 2;
  if (e.type === '3M') return 3;
  if (e.type === 'FT') return e.made || 0;
  return 0;
}

export function ourScore(game) {
  return game.events.reduce((sum, e) => sum + eventPoints(e), 0);
}

export function opponentScore(game) {
  const byPeriod = game.oppP || {};
  return Object.keys(byPeriod).reduce((sum, k) => sum + (+byPeriod[k] || 0), 0);
}

/** [{p, us, them}] desde el 1° cuarto hasta el período actual (mínimo 4). */
export function pointsByPeriod(game) {
  const n = Math.max(REGULAR_PERIODS, game.period), out = [];
  for (let p = 1; p <= n; p++) out.push({ p, us: 0, them: +((game.oppP || {})[p]) || 0 });
  game.events.forEach((e) => { const row = out[e.period - 1]; if (row) row.us += eventPoints(e); });
  return out;
}

/** El tiempo regular (o un suplementario) terminó sin empate. */
export function isGameOver(game, now = Date.now()) {
  return game.period >= REGULAR_PERIODS && remainingMs(game.clock, now) <= 0 && !game.clock.running && ourScore(game) !== opponentScore(game);
}

export function isEnded(game, now = Date.now()) {
  return game.status === 'final' || isGameOver(game, now);
}

export const EMPTY_PLAYER_STATS = Object.freeze({
  pts: 0, m2: 0, a2: 0, m3: 0, a3: 0, ftm: 0, fta: 0, ro: 0, rd: 0, ast: 0, stl: 0, blk: 0, tov: 0,
  pf: 0, fd: 0, tf: 0, uf: 0, df: 0, sec: 0
});

/** Razón por la que un jugador quedó afuera, '' si sigue habilitado. */
export function exclusionReason(s) {
  if (s.df > 0) return 'Descalificado';
  if (s.tf >= 2 || s.uf >= 2 || (s.tf >= 1 && s.uf >= 1)) return 'Descalificado (T/U)';
  if (s.fouls >= 5) return '5 faltas';
  return '';
}

/** Planilla individual de un jugador. Incluye `fouls`, `out`, `outWhy` y `sec` (segundos jugados). */
export function playerStats(game, playerId, now = Date.now()) {
  const s = { ...EMPTY_PLAYER_STATS };
  s.sec = playingTime(game, now)[playerId] || 0;
  game.events.forEach((e) => {
    if (e.who !== playerId) return;
    switch (e.type) {
      case '2M': s.m2++; s.a2++; s.pts += 2; break;
      case '2X': s.a2++; break;
      case '3M': s.m3++; s.a3++; s.pts += 3; break;
      case '3X': s.a3++; break;
      case 'FT': s.fta += e.att; s.ftm += e.made; s.pts += e.made; break;
      case 'RO': s.ro++; break;
      case 'RD': s.rd++; break;
      case 'AST': s.ast++; break;
      case 'STL': s.stl++; break;
      case 'BLK': s.blk++; break;
      case 'TOV': s.tov++; break;
      case 'PF': s.pf++; if (e.sub === 'off') s.tov++; break;
      case 'FD': s.fd++; break;
      case 'TF': s.tf++; break;
      case 'UF': s.uf++; break;
      case 'DF': s.df++; break;
    }
  });
  s.fouls = s.pf + s.tf + s.uf + s.df;
  s.outWhy = exclusionReason(s);
  s.out = s.outWhy !== '';
  return s;
}

/** Faltas de equipo del período (los suplementarios cuentan como el 4° cuarto). */
export function teamFouls(game, period) {
  const key = Math.min(period, REGULAR_PERIODS);
  return game.events.filter((e) => isFoul(e.type) && Math.min(e.period, REGULAR_PERIODS) === key && !isStaff(e.who)).length;
}

/**
 * Faltas de equipo del rival en el período: cada falta recibida por un jugador nuestro es una falta del rival.
 * Los suplementarios cuentan como el 4° cuarto.
 */
export function opponentTeamFouls(game, period) {
  const key = Math.min(period, REGULAR_PERIODS);
  return game.events.filter((e) => e.type === 'FD' && Math.min(e.period, REGULAR_PERIODS) === key).length;
}

/** Con 4 faltas de equipo en el período, cada falta personal siguiente da 2 libres (FIBA). */
export const PENALTY_FOULS = 4;

/** Faltas del cuerpo técnico: c (técnicas DT), b (técnicas banca), d (descalificantes). */
export function staffFouls(game) {
  let c = 0, b = 0, d = 0;
  game.events.forEach((e) => {
    if (e.type === 'TF' && e.who === COACH) c++;
    if (e.type === 'TF' && e.who === BENCH) b++;
    if (e.type === 'DF' && isStaff(e.who)) d++;
  });
  return { c, b, d, out: c >= 2 || c + b >= 3 || d > 0 };
}

/** Tipos de falta del jugador en orden cronológico (para los puntitos). */
export function playerFoulTypes(game, playerId) {
  return game.events
    .filter((e) => e.who === playerId && isFoul(e.type))
    .sort((a, b) => a.period - b.period || b.t - a.t || (a.seq || 0) - (b.seq || 0))
    .map((e) => e.type);
}

/** Jugadas de la más reciente a la más vieja (para el historial). */
export function eventsNewestFirst(game) {
  return game.events.slice().sort((a, b) => b.period - a.period || a.t - b.t || (b.seq || 0) - (a.seq || 0));
}

/** Jugadas en orden cronológico (para exportar). */
export function eventsChronological(game) {
  return game.events.slice().sort((a, b) => a.period - b.period || b.t - a.t || (a.seq || 0) - (b.seq || 0));
}

/** Pérdidas de equipo (24 s, 8 s): no son de ningún jugador. */
export function teamTurnovers(game) {
  return game.events.filter((e) => e.type === 'TTOV').length;
}

/** Suma las estadísticas de todo el plantel del partido, más las pérdidas de equipo. */
export function teamTotals(game) {
  const T = { pts: 0, m2: 0, a2: 0, m3: 0, a3: 0, ftm: 0, fta: 0, ro: 0, rd: 0, ast: 0, stl: 0, blk: 0, tov: 0, fouls: 0, fd: 0, sec: 0 };
  game.roster.forEach((p) => { const s = playerStats(game, p.id); for (const k in T) T[k] += s[k]; });
  T.teamTov = teamTurnovers(game);
  T.tov += T.teamTov;
  return T;
}

/** Cuántos jugadores tiene que haber en cancha (5 o los habilitados que queden). */
export function requiredOnCourt(game) {
  return Math.min(5, game.roster.filter((p) => !playerStats(game, p.id).out).length);
}

/** "75%" o "—". */
export function percent(made, att) {
  return att ? Math.round(made * 100 / att) + '%' : '—';
}

/* ---------- tiempos muertos (FIBA: 2 en el 1er tiempo, 3 en el 2do, 1 por suplementario) ---------- */

const timeoutWindow = (period) => (period <= 2 ? 'h1' : period <= REGULAR_PERIODS ? 'h2' : 'ot' + period);

/** Tiempos muertos disponibles en el tramo del partido que incluye `period`. */
export function timeoutAllowance(period) {
  return period <= 2 ? 2 : period <= REGULAR_PERIODS ? 3 : 1;
}

/** Tiempos muertos usados por 'us' o 'them' en el tramo de `period`. */
export function timeoutsUsed(game, team, period = game.period) {
  const w = timeoutWindow(period);
  return game.events.filter((e) => e.type === 'TO' && (e.team || 'us') === team && timeoutWindow(e.period) === w).length;
}

/** FIBA: en los últimos 2 minutos del 4° cuarto cada equipo puede usar como máximo 2 tiempos muertos. */
export const LAST_MINUTES_SEC = 120;
const LAST_MINUTES_MAX = 2;

export function inLastTwoMinutes(period, secLeft) {
  return period === REGULAR_PERIODS && secLeft != null && secLeft <= LAST_MINUTES_SEC;
}

/** Tiempos muertos que le quedan a `team` en `period`, con `secLeft` segundos en el reloj. */
export function timeoutsLeft(game, team, period = game.period, secLeft = null) {
  let left = timeoutAllowance(period) - timeoutsUsed(game, team, period);
  if (inLastTwoMinutes(period, secLeft)) {
    const usedLast = game.events.filter((e) => e.type === 'TO' && (e.team || 'us') === team && e.period === REGULAR_PERIODS && e.t <= LAST_MINUTES_SEC).length;
    left = Math.min(left, LAST_MINUTES_MAX - usedLast);
  }
  return Math.max(0, left);
}

/** Tiempos muertos usados por tramo: [{label, n}] (1°T, 2°T y cada suplementario jugado). */
export function timeoutsByWindow(game, team) {
  const rows = [{ label: '1°T', n: timeoutsUsed(game, team, 1) }, { label: '2°T', n: timeoutsUsed(game, team, 3) }];
  for (let p = REGULAR_PERIODS + 1; p <= game.period; p++) rows.push({ label: 'S' + (p - REGULAR_PERIODS), n: timeoutsUsed(game, team, p) });
  return rows;
}
