// Reglas del partido en curso. Las funciones que cambian el partido lo mutan y lo dicen en su nombre/doc.

import { isFoul, isStaff, COACH, STAFF_EVENT_TYPES, normalizeSubtype, hasSubtype, isTeamEvent } from './catalog.js';
import {
  REGULAR_PERIODS, periodLengthSec, remainingMs, clockStamp, newClock, pauseClock, parseClockTime, formatSeconds
} from './clock.js';
import { ourScore, opponentScore, isGameOver, playerStats, teamFouls, staffFouls, requiredOnCourt } from './stats.js';
import { findPlayer } from './describe.js';

/** Completa un partido recién leído del store con valores por defecto. Muta `game`. */
export function hydrateGame(game, events) {
  game.events = events;
  game.oppP = game.oppP || {};
  game.status = game.status || 'live';
  game.seq = Math.max(game.seq || 1, events.reduce((a, e) => Math.max(a, (e.seq || 0) + 1), 1));
  return game;
}

/** Documento del partido para guardar (sin jugadas, con resumen del tanteador). */
export function gameDocument(game) {
  const doc = {};
  Object.keys(game).forEach((k) => { if (k !== 'events' && k !== 'id') doc[k] = game[k]; });
  doc.summary = { us: ourScore(game), them: opponentScore(game) };
  return doc;
}

/** Momento capturado al tocar la cancha (o sin ubicación). */
export function captureMoment(game, x = null, y = null, now = Date.now()) {
  return { x, y, period: game.period, t: clockStamp(game.clock, now) };
}

/** Acción sin ubicación ni jugador (tiempo muerto, revisión). `team`: 'us' | 'them' para los tiempos muertos. */
export function stoppageEvent(moment, type, team) {
  const e = { period: moment.period, t: moment.t, x: null, y: null, who: null, type };
  if (team) e.team = team;
  return e;
}

/** Agrega la jugada al partido asignándole seq/rev/at. Muta `game` y `event`. */
export function appendEvent(game, event, newId, now = Date.now()) {
  event.id = event.id || newId();
  event.seq = game.seq++;
  event.rev = 1;
  event.at = now;
  game.events.push(event);
  return event;
}

/** Marca una nueva revisión de la jugada. Muta `event`. */
export function touchEvent(event, now = Date.now()) {
  event.rev = (event.rev || 1) + 1;
  event.at = now;
}

/** Saca la jugada del partido. Devuelve la jugada quitada o null. Muta `game`. */
export function removeEvent(game, id) {
  const e = game.events.find((x) => String(x.id) === String(id));
  if (!e) return null;
  game.events = game.events.filter((x) => x !== e);
  return e;
}

/** La última jugada cargada (por orden de carga). */
export function lastLoggedEvent(game) {
  return game.events.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0)).pop() || null;
}

/** Motivo por el que no se puede cargar una jugada a `who`, o '' si se puede. */
export function playBlockReason(game, who, label) {
  if (who === COACH && staffFouls(game).out) return 'El DT ya está descalificado: no se le pueden cargar más faltas.';
  if (findPlayer(game, who) && playerStats(game, who).out) return label + ' ya está fuera del partido.';
  return '';
}

/** Arma la jugada a partir del momento capturado y la acción elegida. */
export function buildPlayEvent(moment, { who, type, sub, att, made }) {
  const e = {
    period: moment.period, t: moment.t,
    x: moment.x == null ? null : Math.round(moment.x), y: moment.y == null ? null : Math.round(moment.y),
    who, type
  };
  if (sub) e.sub = sub;
  if (type === 'FT') { e.att = att; e.made = made; }
  return e;
}

/**
 * Consecuencias de una jugada recién agregada.
 * @param {object} before {wasOut, teamFoulsBefore} medidos antes de agregarla
 * @returns {{forced: object|null, exclusion: string, fourthTeamFoul: boolean, staffOut: boolean}}
 */
export function playConsequences(game, e, before) {
  const result = { forced: null, exclusion: '', fourthTeamFoul: false, staffOut: false };
  if (findPlayer(game, e.who)) {
    const s = playerStats(game, e.who);
    if (s.out && !before.wasOut) {
      if (game.onCourt.includes(e.who)) result.forced = { out: e.who, why: s.outWhy, evId: e.id };
      else result.exclusion = s.outWhy;
    }
    if (isFoul(e.type) && !result.exclusion) {
      result.fourthTeamFoul = teamFouls(game, e.period) === 4 && before.teamFoulsBefore === 3;
    }
  }
  if (isStaff(e.who) && staffFouls(game).out) result.staffOut = true;
  return result;
}

/** Jugador en cancha que quedó excluido (p. ej. tras editar el historial) y debe salir. */
export function pendingForcedExit(game) {
  const out = game.onCourt.find((id) => playerStats(game, id).out);
  if (!out) return null;
  const lastFoul = game.events.filter((e) => e.who === out && isFoul(e.type)).slice(-1)[0];
  return { out, why: playerStats(game, out).outWhy, evId: lastFoul ? lastFoul.id : null };
}

/** Jugadores de la banca que pueden entrar. */
export function benchCandidates(game) {
  return game.roster.filter((p) => !game.onCourt.includes(p.id) && !playerStats(game, p.id).out);
}

/** Puntos del rival: +n al período actual; -1 descuenta del actual o del último con puntos. Muta `game`. */
export function adjustOpponentScore(game, delta) {
  const byPeriod = game.oppP = game.oppP || {};
  const key = String(game.period);
  if (delta > 0) { byPeriod[key] = (+byPeriod[key] || 0) + delta; return; }
  let k = key;
  if (!(+byPeriod[k] > 0)) k = Object.keys(byPeriod).filter((x) => +byPeriod[x] > 0).sort((a, b) => b - a)[0];
  if (k) byPeriod[k] = Math.max(0, (+byPeriod[k] || 0) - 1);
}

/**
 * Cambio libre: `selected` son los que quedan en cancha.
 * Devuelve {inn, out} o null si la cantidad no es la requerida. Muta `game.onCourt`.
 */
export function applySubstitution(game, selected) {
  if (selected.length !== requiredOnCourt(game)) return null;
  const inn = selected.filter((x) => !game.onCourt.includes(x));
  const out = game.onCourt.filter((x) => !selected.includes(x));
  game.onCourt = game.roster.map((p) => p.id).filter((x) => selected.includes(x));
  return { inn, out };
}

/** Cambio obligatorio: sale `outId`, entra `inId` (o nadie). Muta `game.onCourt`. */
export function applyForcedSubstitution(game, outId, inId) {
  const ix = game.onCourt.indexOf(outId);
  if (inId) game.onCourt[ix] = inId; else game.onCourt.splice(ix, 1);
  return { inn: inId ? [inId] : [], out: [outId] };
}

/**
 * Cambio que no se cargó a tiempo: entra `inId` por `outId` (o sin que salga nadie si hay lugar).
 * Devuelve {inn, out} o null si no corresponde. Muta `game.onCourt`.
 */
export function applyLateSubstitution(game, inId, outId) {
  if (game.onCourt.includes(inId) || !findPlayer(game, inId) || playerStats(game, inId).out) return null;
  if (outId) {
    const ix = game.onCourt.indexOf(outId);
    if (ix < 0) return null;
    game.onCourt[ix] = inId;
    return { inn: [inId], out: [outId] };
  }
  if (game.onCourt.length >= requiredOnCourt(game)) return null;
  game.onCourt.push(inId);
  return { inn: [inId], out: [] };
}

/** Evento de cambio fechado en un momento ya capturado (período y tiempo de la jugada). */
export function substitutionEventAt(moment, { inn, out }) {
  return { period: moment.period, t: moment.t, x: null, y: null, who: null, type: 'SUB', inn, out };
}

export function substitutionEvent(game, { inn, out }, now = Date.now()) {
  return { period: game.period, t: clockStamp(game.clock, now), x: null, y: null, who: null, type: 'SUB', inn, out };
}

/** Pasa al período siguiente. Devuelve false si el partido ya está definido. Muta `game`. */
export function advancePeriod(game) {
  if (game.period >= REGULAR_PERIODS && ourScore(game) !== opponentScore(game)) return false;
  game.period++;
  game.status = 'live';
  game.clock = newClock(periodLengthSec(game, game.period) * 1000);
  return true;
}

/** Ajuste manual del reloj: deja el reloj pausado en el período y tiempo dados. Muta `game`. */
export function setClockManually(game, period, minutes, seconds) {
  const t = Math.min(periodLengthSec(game, period), minutes * 60 + seconds);
  game.period = period;
  game.clock = newClock(t * 1000);
  if (game.status === 'final' && (t > 0 || period < REGULAR_PERIODS)) game.status = 'live';
}

/** Finaliza el partido. Muta `game`. */
export function finishGame(game, now = Date.now()) {
  pauseClock(game.clock, now);
  game.status = 'final';
  game.endedAt = now;
}

/**
 * Se llama en cada tick con el reloj corriendo.
 * @returns {'running'|'final'|'period-end'} qué pasó
 */
export function tickClock(game, now = Date.now()) {
  if (remainingMs(game.clock, now) > 0) return 'running';
  game.clock.rem = 0;
  game.clock.running = false;
  if (isGameOver(game, now) && game.status !== 'final') {
    game.status = 'final';
    game.endedAt = now;
    return 'final';
  }
  return 'period-end';
}

/* ---------- edición de jugadas ---------- */

export function newEditDraft(event) {
  return Object.assign({}, event, { timeStr: formatSeconds(event.t), err: '' });
}

/** Corrige combinaciones inválidas del borrador. Muta `draft`. */
export function normalizeEditDraft(draft) {
  if (isStaff(draft.who) && !STAFF_EVENT_TYPES.includes(draft.type)) draft.type = 'TF';
  if (hasSubtype(draft.type)) draft.sub = normalizeSubtype(draft.type, draft.sub);
  if (draft.type === 'FT') { draft.att = draft.att || 1; draft.made = Math.min(draft.made || 0, draft.att); }
}

/**
 * Aplica el borrador a la jugada original. Devuelve '' si salió bien o el mensaje de error. Muta `event`.
 */
export function applyEditDraft(game, event, draft) {
  const t = parseClockTime(draft.timeStr);
  const max = periodLengthSec(game, draft.period);
  if (t == null || t > max) return 'Tiempo inválido. Usá 7:32 o 45.3 (máx. ' + formatSeconds(max) + ').';
  event.period = draft.period;
  event.t = t;
  if (!isTeamEvent(event.type)) {
    event.who = draft.who;
    event.type = draft.type;
    delete event.sub; delete event.att; delete event.made;
    if (hasSubtype(draft.type)) event.sub = draft.sub;
    if (draft.type === 'FT') { event.att = draft.att; event.made = Math.min(draft.made, draft.att); }
  }
  return '';
}
