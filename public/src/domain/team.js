// Plantel: borradores, validación y armado del documento a guardar.

import { newId, shortId, todayISO } from '../shared/ids.js';
import { DEFAULT_TEAM_COLOR } from '../shared/colors.js';

export const MAX_PLAYERS_PER_TEAM = 30;
export const DEFAULT_PERIOD_MIN = '10';
export const MAX_VENUES_PER_TEAM = 10;

export function activePlayers(team) {
  return ((team && team.players) || []).filter((p) => p.active !== false);
}

export function newDraftPlayer() {
  return { id: shortId(), num: '', name: '', active: true, fresh: true };
}

/* ---------- estadios (dónde jugamos de local) ---------- */

export function newDraftVenue() {
  return { id: shortId(), name: '', location: '' };
}

/** Estadios cargados del plantel (con nombre). */
export function teamVenues(team) {
  return ((team && team.venues) || []).filter((v) => v && v.id && String(v.name || '').trim());
}

/** Copia editable de un plantel guardado: siempre con al menos una fila de estadio para completar. */
export function editableTeamDraft(team) {
  const draft = JSON.parse(JSON.stringify(team));
  draft.venues = Array.isArray(draft.venues) && draft.venues.length ? draft.venues : [newDraftVenue()];
  return draft;
}

export function blankTeamDraft() {
  return {
    id: newId(), isNew: true, name: '', color: DEFAULT_TEAM_COLOR, coach: '', competition: '', periodMin: DEFAULT_PERIOD_MIN,
    players: [0, 1, 2, 3, 4].map(newDraftPlayer), venues: [newDraftVenue()]
  };
}

/** Plantel de ejemplo para el modo demo. */
export function exampleTeam() {
  const list = [['4', 'Tomás Ferreyra', 1], ['5', 'Bruno Acosta', 1], ['7', 'Lucas Medina', 1], ['9', 'Facundo Ríos', 1], ['11', 'Nicolás Vera', 1],
    ['6', 'Joaquín Sosa'], ['8', 'Ignacio Paz'], ['10', 'Santiago Luna'], ['12', 'Mateo Ibarra'], ['13', 'Franco Godoy'], ['14', 'Agustín Molina'], ['15', 'Valentín Rey']];
  return {
    example: true, team: 'Unión Central', opponent: 'Deportivo Norte', coach: 'Raúl Benítez', date: todayISO(), periodMin: DEFAULT_PERIOD_MIN,
    players: list.map((p) => ({ id: shortId(), num: p[0], name: p[1], starter: !!p[2] }))
  };
}

/**
 * Primer plantel del usuario: el del último partido (versiones anteriores), el de ejemplo en demo, o vacío.
 * @param {object|null} profile perfil del usuario (puede traer `lastSetup`)
 * @param {boolean} demo
 */
export function seedTeamDraft(profile, demo) {
  const last = profile && profile.lastSetup;
  if (last && last.players && last.players.length) {
    return Object.assign(blankTeamDraft(), {
      seeded: 'last', name: last.team || '', color: last.teamColor || DEFAULT_TEAM_COLOR, coach: last.coach || '',
      competition: last.competition || '', periodMin: String(last.periodMin || DEFAULT_PERIOD_MIN),
      players: last.players.map((p) => ({ id: p.id || shortId(), num: p.num, name: p.name, active: true }))
    });
  }
  if (demo) {
    const ex = exampleTeam();
    return Object.assign(blankTeamDraft(), {
      seeded: 'example', name: ex.team, coach: ex.coach,
      venues: [
        { id: shortId(), name: 'Estadio Unión Central', location: 'Av. San Martín 1450, Rafaela' },
        { id: shortId(), name: 'Cancha auxiliar', location: 'Bv. Lehmann 300, Rafaela' }
      ],
      players: ex.players.map((p) => ({ id: p.id, num: p.num, name: p.name, active: true, fresh: true }))
    });
  }
  return blankTeamDraft();
}

/**
 * Valida el borrador y arma el documento a guardar.
 * @returns {{error: string} | {doc: object}}
 */
export function buildTeamDocument(draft, now = Date.now()) {
  const players = draft.players.filter((p) => String(p.num).trim() !== '' || String(p.name).trim() !== '');
  if (!String(draft.name).trim()) return { error: 'Falta el nombre del equipo.' };
  if (!players.length) return { error: 'Cargá al menos un jugador.' };
  const seen = {};
  for (const p of players) {
    const n = String(p.num).trim();
    if (!/^\d{1,2}$/.test(n)) return { error: 'Cada jugador necesita un número (0 a 99).' };
    if (p.active !== false) {
      if (seen[n]) return { error: 'El número ' + n + ' está repetido entre los jugadores activos.' };
      seen[n] = 1;
    }
  }
  const venues = (draft.venues || [])
    .map((v) => ({ id: v.id, name: String(v.name || '').trim(), location: String(v.location || '').trim() }))
    .filter((v) => v.name || v.location);
  const venueNames = {};
  for (const v of venues) {
    if (!v.name || !v.location) return { error: 'Cada estadio necesita nombre y ubicación.' };
    const key = v.name.toLowerCase();
    if (venueNames[key]) return { error: 'Hay dos estadios llamados «' + v.name + '».' };
    venueNames[key] = 1;
  }
  if (venues.length > MAX_VENUES_PER_TEAM) return { error: 'Se pueden cargar hasta ' + MAX_VENUES_PER_TEAM + ' estadios.' };
  const doc = {
    name: String(draft.name).trim(), color: draft.color || DEFAULT_TEAM_COLOR, coach: String(draft.coach || '').trim(),
    competition: String(draft.competition || '').trim(), periodMin: String(draft.periodMin || DEFAULT_PERIOD_MIN),
    players: players.map((p) => ({ id: p.id, num: String(p.num).trim(), name: String(p.name).trim(), active: p.active !== false })),
    venues
  };
  if (draft.isNew) doc.createdAt = now;
  return { doc };
}

/** Competiciones ya usadas (para sugerir), ordenadas. */
export function knownCompetitions(games, teams) {
  const seen = {};
  (games || []).concat(teams || []).forEach((x) => { if (x.competition) seen[x.competition] = 1; });
  return Object.keys(seen).sort();
}
