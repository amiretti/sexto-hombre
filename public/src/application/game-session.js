// Caso de uso: llevar un partido en curso y mantenerlo guardado.
// Depende del puerto `store` (ver infrastructure/store) y no del DOM.

import { newId } from '../shared/ids.js';
import { EVENT_LABELS } from '../domain/catalog.js';
import { eventPoints, playerStats, teamFouls, staffFouls } from '../domain/stats.js';
import { whoLabel, eventDetail, findPlayer } from '../domain/describe.js';
import { pauseClock } from '../domain/clock.js';
import {
  gameDocument, appendEvent, touchEvent, removeEvent, buildPlayEvent, playBlockReason, playConsequences
} from '../domain/game.js';

const pauseClockOf = (game) => pauseClock(game.clock);

const PERSIST_DEBOUNCE_MS = 350;

/**
 * @param {object} deps
 * @param {object} deps.store   puerto de datos (saveGame, putEvent, deleteEvent)
 * @param {(err: any) => void} deps.onSaveError
 */
export function createGameSession({ store, onSaveError }) {
  let game = null;
  let timer = null;

  const fail = (e) => onSaveError(e);

  function persistNow() {
    clearTimeout(timer);
    if (!game) return;
    store.saveGame(game.id, gameDocument(game)).catch(fail);
  }

  function schedulePersist() {
    clearTimeout(timer);
    timer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
  }

  function addEvent(e) {
    appendEvent(game, e, newId);
    store.putEvent(game.id, e).catch(fail);
    schedulePersist();
    return e;
  }

  function updateEvent(e) {
    touchEvent(e);
    store.putEvent(game.id, e).catch(fail);
    schedulePersist();
  }

  function deleteEvent(id) {
    const e = removeEvent(game, id);
    if (!e) return null;
    store.deleteEvent(game.id, e).catch(fail);
    schedulePersist();
    return e;
  }

  /** Texto de una jugada para avisos: "#7 Medina · Doble convertido · +2". */
  function describePlay(e) {
    const d = eventDetail(game, e), pts = eventPoints(e);
    return whoLabel(game, e.who) + ' · ' + EVENT_LABELS[e.type] + (d ? ' · ' + d : '') + (pts ? ' · +' + pts : '');
  }

  /**
   * Registra una jugada tomada en `moment` (ver domain/game captureMoment).
   * @returns {{error: string} | {event, message: string, warn: boolean, forced: object|null}}
   */
  function recordPlay(moment, action) {
    const who = action.who;
    const blocked = playBlockReason(game, who, whoLabel(game, who));
    if (blocked) return { error: blocked };

    const e = buildPlayEvent(moment, action);
    const before = {
      wasOut: findPlayer(game, e.who) ? playerStats(game, e.who).out : false,
      teamFoulsBefore: teamFouls(game, e.period)
    };
    addEvent(e);

    const c = playConsequences(game, e, before);
    if (c.forced) { pauseClockOf(game); schedulePersist(); return { event: e, forced: c.forced, message: '', warn: false }; }

    let message = describePlay(e), warn = false;
    if (c.exclusion) { message = whoLabel(game, e.who) + ': ' + c.exclusion + '. Queda fuera del partido.'; warn = true; }
    if (c.fourthTeamFoul) { message += ' · 4 faltas de equipo'; warn = true; }
    if (c.staffOut) { const s = staffFouls(game); message = 'DT descalificado (DT: ' + s.c + ' C · Banca: ' + s.b + ' B)'; warn = true; }
    return { event: e, forced: null, message, warn };
  }

  return {
    get game() { return game; },
    /** Empieza a llevar `g` (o null para soltar el partido actual, guardándolo antes). */
    open(g) { if (game && game !== g) persistNow(); game = g; },
    close() { if (game) persistNow(); game = null; },
    persistNow,
    schedulePersist,
    addEvent,
    updateEvent,
    deleteEvent,
    describePlay,
    recordPlay
  };
}
