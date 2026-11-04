// Plantel: borradores, validación y armado del documento a guardar.

import { newId, shortId, todayISO } from '../shared/ids.js';

export const MAX_PLAYERS_PER_TEAM = 30;
export const DEFAULT_PERIOD_MIN = '10';

export function activePlayers(team) {
  return ((team && team.players) || []).filter((p) => p.active !== false);
}

export function newDraftPlayer() {
  return { id: shortId(), num: '', name: '', active: true, fresh: true };
}

/** Categorías sugeridas al cargar un plantel. */
export const CATEGORY_SUGGESTIONS = ['Primera', 'Reserva', 'U21', 'U19', 'U17', 'U15', 'U13', 'Femenino', 'Maxi'];

/** Copia editable de un plantel guardado. */
export function editableTeamDraft(team) {
  return JSON.parse(JSON.stringify(team));
}

/** @param {string|null} clubId club al que pertenece */
export function blankTeamDraft(clubId = null) {
  return {
    id: newId(), isNew: true, clubId, category: '', coach: '', competition: '', periodMin: DEFAULT_PERIOD_MIN,
    players: [0, 1, 2, 3, 4].map(newDraftPlayer)
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
 * @param {string|null} clubId
 */
export function seedTeamDraft(profile, demo, clubId = null) {
  const last = profile && profile.lastSetup;
  if (last && last.players && last.players.length) {
    return Object.assign(blankTeamDraft(clubId), {
      seeded: 'last', category: 'Primera', coach: last.coach || '',
      competition: last.competition || '', periodMin: String(last.periodMin || DEFAULT_PERIOD_MIN),
      players: last.players.map((p) => ({ id: p.id || shortId(), num: p.num, name: p.name, active: true }))
    });
  }
  if (demo) {
    const ex = exampleTeam();
    return Object.assign(blankTeamDraft(clubId), {
      seeded: 'example', category: 'Primera', coach: ex.coach,
      players: ex.players.map((p) => ({ id: p.id, num: p.num, name: p.name, active: true, fresh: true }))
    });
  }
  return blankTeamDraft(clubId);
}

/**
 * Valida el borrador y arma el documento a guardar.
 * @param {object[]} [siblings] los demás planteles del usuario (para no repetir la categoría en el club)
 * @returns {{error: string} | {doc: object}}
 */
export function buildTeamDocument(draft, siblings = [], now = Date.now()) {
  const players = draft.players.filter((p) => String(p.num).trim() !== '' || String(p.name).trim() !== '');
  const category = String(draft.category || '').trim();
  if (!draft.clubId) return { error: 'Elegí el club del plantel.' };
  if (!category) return { error: 'Falta la categoría (Primera, U17, Femenino…).' };
  if (siblings.some((t) => t.id !== draft.id && t.clubId === draft.clubId && String(t.category || '').trim().toLowerCase() === category.toLowerCase())) {
    return { error: 'Ese club ya tiene un plantel «' + category + '».' };
  }
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
  const doc = {
    clubId: draft.clubId, category, coach: String(draft.coach || '').trim(),
    competition: String(draft.competition || '').trim(), periodMin: String(draft.periodMin || DEFAULT_PERIOD_MIN),
    players: players.map((p) => ({ id: p.id, num: String(p.num).trim(), name: String(p.name).trim(), active: p.active !== false }))
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
