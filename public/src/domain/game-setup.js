// Previa del partido: convocatoria, quinteto y creación del partido.

import { newId, todayISO } from '../shared/ids.js';
import { DEFAULT_TEAM_COLOR, DEFAULT_OPPONENT_COLOR } from '../shared/colors.js';
import { activePlayers, DEFAULT_PERIOD_MIN } from './team.js';
import { newClock } from './clock.js';

export const SETUP_VERSION = 2;

export function blankSetup() {
  return { v: SETUP_VERSION, teamId: null, opponent: '', oppColor: DEFAULT_OPPONENT_COLOR, venue: 'home', date: todayISO(), sel: {} };
}

/** Toma los datos por defecto del plantel y convoca a todos sus activos. Muta `setup`. */
export function applyTeamToSetup(setup, team) {
  const lastStarters = team.lastStarters || [];
  setup.teamId = team.id;
  setup.teamColor = team.color || DEFAULT_TEAM_COLOR;
  setup.coach = team.coach || '';
  setup.competition = team.competition || '';
  setup.periodMin = String(team.periodMin || DEFAULT_PERIOD_MIN);
  setup.sel = {};
  activePlayers(team).forEach((p) => { setup.sel[p.id] = { in: true, starter: lastStarters.includes(p.id) }; });
}

/** Suma a los jugadores nuevos del plantel (convocados) y quita a los que ya no están activos. Muta `setup`. */
export function reconcileSelection(setup, team) {
  if (!team) return;
  setup.sel = setup.sel || {};
  const ids = {};
  activePlayers(team).forEach((p) => { ids[p.id] = 1; if (!setup.sel[p.id]) setup.sel[p.id] = { in: true, starter: false }; });
  Object.keys(setup.sel).forEach((k) => { if (!ids[k]) delete setup.sel[k]; });
}

export function toggleCalled(setup, playerId) {
  const c = setup.sel[playerId] = setup.sel[playerId] || {};
  c.in = !c.in;
  if (!c.in) c.starter = false;
}

/** Devuelve false si el jugador no está convocado. */
export function toggleStarter(setup, playerId) {
  const c = setup.sel[playerId];
  if (!(c && c.in)) return false;
  c.starter = !c.starter;
  return true;
}

export function calledPlayers(setup, team) {
  const sel = setup.sel || {};
  return activePlayers(team).filter((p) => sel[p.id] && sel[p.id].in);
}

export function starterIds(setup, team) {
  return calledPlayers(setup, team).filter((p) => setup.sel[p.id].starter).map((p) => p.id);
}

/**
 * Valida la previa y crea el partido.
 * @returns {{error: string} | {game: object, starters: string[]}}
 */
export function createGame(setup, team, now = Date.now()) {
  if (!team) return { error: 'Elegí el plantel.' };
  const players = calledPlayers(setup, team);
  const starters = starterIds(setup, team);
  if (!String(setup.opponent).trim()) return { error: 'Falta el nombre del rival.' };
  if (players.length < 5) return { error: 'Convocá al menos 5 jugadores.' };
  if (starters.length !== 5) return { error: 'Elegí exactamente 5 titulares.' };
  const seen = {};
  for (const p of players) {
    const n = String(p.num).trim();
    if (seen[n]) return { error: 'El número ' + n + ' está repetido. Corregilo en el plantel.' };
    seen[n] = 1;
  }
  const periodMin = +setup.periodMin || 10;
  const game = {
    id: newId(), status: 'live', teamId: team.id, venue: setup.venue === 'away' ? 'away' : 'home',
    competition: String(setup.competition || '').trim(), createdAt: now, oppP: {},
    teamColor: setup.teamColor || team.color || DEFAULT_TEAM_COLOR, oppColor: setup.oppColor || DEFAULT_OPPONENT_COLOR,
    team: team.name, opponent: String(setup.opponent).trim(), coach: String(setup.coach || '').trim(), date: setup.date, periodMin,
    roster: players.map((p) => ({ id: p.id, num: String(p.num).trim(), name: String(p.name || '').trim() })),
    starters: starters.slice(), onCourt: starters.slice(),
    period: 1, clock: newClock(periodMin * 60000), events: [], seq: 1
  };
  return { game, starters };
}
