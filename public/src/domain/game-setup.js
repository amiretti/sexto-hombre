// Previa del partido: convocatoria, quinteto y creación del partido.
// `team` es siempre un plantel resuelto con su club (domain/club resolveTeam): nombre, colores y estadios.

import { newId, todayISO } from '../shared/ids.js';
import { DEFAULT_TEAM_COLOR, DEFAULT_OPPONENT_COLOR } from '../shared/colors.js';
import { activePlayers, categoryLabel, normalizeCategory, DEFAULT_PERIOD_MIN } from './team.js';
import { competitionLabel } from './competition.js';
import { venuesOf } from './club.js';
import { newClock } from './clock.js';

export const SETUP_VERSION = 2;

export function blankSetup() {
  return { v: SETUP_VERSION, teamId: null, opponent: '', oppColor: DEFAULT_OPPONENT_COLOR, venue: 'home', venueId: null, attack: 'right', date: todayISO(), sel: {} };
}

/**
 * Toma los datos por defecto del plantel y convoca a todos sus activos. Muta `setup`.
 * @param {object[]} [competitions] competiciones disponibles (se propone la última que usó el plantel)
 */
export function applyTeamToSetup(setup, team, competitions = []) {
  const lastStarters = team.lastStarters || [];
  setup.teamId = team.id;
  setup.teamColor = team.color || DEFAULT_TEAM_COLOR;
  setup.coach = team.coach || '';
  setup.periodMin = String(team.periodMin || DEFAULT_PERIOD_MIN);
  chooseCompetition(setup, (competitions || []).find((c) => c.id === team.lastCompetitionId && !c.deleted) || null, team);
  setup.sel = {};
  activePlayers(team).forEach((p) => { setup.sel[p.id] = { in: true, starter: lastStarters.includes(p.id) }; });
  setup.venueId = null;
  reconcileVenue(setup, team);
}

/**
 * Si no hay un estadio elegido (o ya no existe) se propone el por defecto del plantel o, si tiene uno solo, ese.
 * Muta `setup`.
 */
function reconcileVenue(setup, team) {
  const venues = venuesOf(team);
  if (venues.some((v) => v.id === setup.venueId)) return;
  const byDefault = venues.find((v) => v.id === (team && team.defaultVenueId));
  setup.venueId = byDefault ? byDefault.id : venues.length === 1 ? venues[0].id : null;
}

/** Estadio donde se juega: solo de local y si el plantel tiene estadios cargados. null si no corresponde. */
export function selectedVenue(setup, team) {
  if (setup.venue === 'away') return null;
  return venuesOf(team).find((v) => v.id === setup.venueId) || null;
}

/** Suma a los jugadores nuevos del plantel (convocados) y quita a los que ya no están activos. Muta `setup`. */
export function reconcileSelection(setup, team) {
  if (!team) return;
  setup.sel = setup.sel || {};
  const ids = {};
  activePlayers(team).forEach((p) => { ids[p.id] = 1; if (!setup.sel[p.id]) setup.sel[p.id] = { in: true, starter: false }; });
  Object.keys(setup.sel).forEach((k) => { if (!ids[k]) delete setup.sel[k]; });
  reconcileVenue(setup, team);
}

/**
 * Elige la competición (null = amistoso / sin competición) y propone su duración del cuarto. Muta `setup`.
 * @param {object} [team] sin competición vuelve a la duración del plantel
 */
export function chooseCompetition(setup, competition, team) {
  setup.competitionId = competition ? competition.id : null;
  if (competition && competition.periodMin) setup.periodMin = String(competition.periodMin);
  else if (team) setup.periodMin = String(team.periodMin || DEFAULT_PERIOD_MIN);
}

/** Camiseta que usamos según el color elegido: 'main', 'alt' o null (otro color). */
export function kitOf(setup, team) {
  const c = String(setup.teamColor || '').toLowerCase();
  if (team && c === String(team.color || '').toLowerCase()) return 'main';
  if (team && team.altColor && c === String(team.altColor).toLowerCase()) return 'alt';
  return null;
}

/** Pasa a la camiseta titular o alternativa del club. Muta `setup`. */
export function chooseKit(setup, team, kit) {
  const color = kit === 'alt' ? team && team.altColor : team && team.color;
  if (color) setup.teamColor = color;
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
 * @param {object|null} [competition] la competición elegida (setup.competitionId)
 * @returns {{error: string} | {game: object, starters: string[]}}
 */
export function createGame(setup, team, now = Date.now(), competition = null) {
  if (!team) return { error: 'Elegí el plantel.' };
  const players = calledPlayers(setup, team);
  const starters = starterIds(setup, team);
  if (!String(setup.opponent).trim()) return { error: 'Falta el nombre del rival.' };
  const stadium = selectedVenue(setup, team);
  if (setup.venue !== 'away' && venuesOf(team).length && !stadium) return { error: 'Elegí en qué estadio se juega.' };
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
    attackFirstHalf: setup.attack === 'left' ? 'left' : 'right',
    // Copia del nombre: si después se edita la competición, el partido conserva cómo se llamaba.
    competitionId: competition ? competition.id : null, competition: competitionLabel(competition), createdAt: now, oppP: {},
    teamColor: setup.teamColor || team.color || DEFAULT_TEAM_COLOR, oppColor: setup.oppColor || DEFAULT_OPPONENT_COLOR,
    clubId: team.clubId || null, category: categoryLabel(team), branch: normalizeCategory(team).branch,
    team: team.name, opponent: String(setup.opponent).trim(), coach: String(setup.coach || '').trim(), date: setup.date, periodMin,
    roster: players.map((p) => ({ id: p.id, num: String(p.num).trim(), name: String(p.name || '').trim() })),
    starters: starters.slice(), onCourt: starters.slice(),
    period: 1, clock: newClock(periodMin * 60000), events: [], seq: 1
  };
  // Copia del estadio (si después se edita el plantel, el partido conserva dónde se jugó).
  if (stadium) game.stadium = { name: stadium.name, location: stadium.location };
  return { game, starters };
}
