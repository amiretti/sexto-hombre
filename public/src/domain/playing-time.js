// Tiempo jugado: se reconstruye con el quinteto inicial, los cambios (SUB, con período y reloj) y el reloj actual.
// No se guarda nada nuevo, así que también sale para los partidos ya jugados.

import { periodLengthSec, remainingMs } from './clock.js';

const chrono = (a, b) => a.period - b.period || b.t - a.t || (a.seq || 0) - (b.seq || 0);

/** Quinteto con el que arrancó el partido: el guardado, o el actual deshaciendo los cambios. */
function startingLineup(game, subs) {
  if (Array.isArray(game.starters) && game.starters.length) return new Set(game.starters);
  const on = new Set(game.onCourt || []);
  for (let i = subs.length - 1; i >= 0; i--) {
    (subs[i].inn || []).forEach((id) => on.delete(id));
    (subs[i].out || []).forEach((id) => on.add(id));
  }
  return on;
}

/**
 * Segundos jugados por cada jugador.
 * Los períodos ya terminados cuentan completos; el período en curso, hasta el reloj actual.
 * @returns {Object<string, number>} id del jugador → segundos
 */
export function playingTime(game, now = Date.now()) {
  const out = {};
  if (!game || !(+game.period >= 1) || !(+game.periodMin > 0)) return out;
  const subs = (game.events || []).filter((e) => e.type === 'SUB' && e.period <= game.period).sort(chrono);
  const on = startingLineup(game, subs);
  const add = (sec) => { if (sec > 0) on.forEach((id) => { out[id] = (out[id] || 0) + sec; }); };
  let k = 0;
  for (let p = 1; p <= game.period; p++) {
    const len = periodLengthSec(game, p);
    let cur = len;
    for (; k < subs.length && subs[k].period === p; k++) {
      const e = subs[k], t = Math.max(0, Math.min(cur, +e.t || 0));
      add(cur - t);
      cur = t;
      (e.out || []).forEach((id) => on.delete(id));
      (e.inn || []).forEach((id) => on.add(id));
    }
    const end = p < game.period || !game.clock ? 0 : Math.max(0, Math.min(len, remainingMs(game.clock, now) / 1000));
    add(cur - Math.min(cur, end));
  }
  for (const id in out) out[id] = Math.round(out[id] * 10) / 10;
  return out;
}

/** Segundos → "23:41". */
export function formatMinutes(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
