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

/* ---------- categoría y rama ---------- */

/** Categorías de la app, de menor a mayor. */
export const CATEGORIES = ['Mini', 'U13', 'U15', 'U17', 'U19', 'U21', 'Reserva', 'Primera', 'Maxi'];
/** Rama: masculino, femenino o mixto. */
export const BRANCHES = { m: { label: 'Masculino', short: 'Masc.' }, f: { label: 'Femenino', short: 'Fem.' }, x: { label: 'Mixto', short: 'Mixto' } };
export const DEFAULT_BRANCH = 'm';

/**
 * Categoría y rama a partir de lo que tenga el plantel (texto libre de versiones anteriores incluido):
 * "U17 Femenino" → {category: 'U17', branch: 'f'}. Lo que no es de la lista se conserva tal cual.
 */
export function normalizeCategory(team) {
  const raw = String((team && team.category) || '').trim();
  let branch = team && BRANCHES[team.branch] ? team.branch : null;
  if (!branch) branch = /fem/i.test(raw) ? 'f' : /mixt/i.test(raw) ? 'x' : DEFAULT_BRANCH;
  const base = raw.replace(/(^|\s)(femenin[oa]s?|fem\.?|masculin[oa]s?|masc\.?|mixt[oa]s?)(?=\s|$)/gi, ' ').replace(/\s+/g, ' ').trim();
  const known = CATEGORIES.find((c) => c.toLowerCase() === base.toLowerCase());
  // Solo la rama ("Femenino"): la categoría mayor.
  return { category: known || base || (raw ? 'Primera' : ''), branch };
}

/** "U17 Femenino" (o "U17 Fem." en corto). */
export function categoryLabel(team, short = false) {
  const { category, branch } = normalizeCategory(team);
  if (!category) return '';
  return category + ' ' + BRANCHES[branch][short ? 'short' : 'label'];
}

/** Copia editable de un plantel guardado. */
export function editableTeamDraft(team) {
  return Object.assign(JSON.parse(JSON.stringify(team)), normalizeCategory(team));
}

/** @param {string|null} clubId club al que pertenece */
export function blankTeamDraft(clubId = null) {
  return {
    id: newId(), isNew: true, clubId, category: 'Primera', branch: DEFAULT_BRANCH, coach: '', periodMin: DEFAULT_PERIOD_MIN,
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
      seeded: 'last', coach: last.coach || '', periodMin: String(last.periodMin || DEFAULT_PERIOD_MIN),
      players: last.players.map((p) => ({ id: p.id || shortId(), num: p.num, name: p.name, active: true }))
    });
  }
  if (demo) {
    const ex = exampleTeam();
    return Object.assign(blankTeamDraft(clubId), {
      seeded: 'example', coach: ex.coach,
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
  const { category, branch } = normalizeCategory(draft);
  if (!draft.clubId) return { error: 'Elegí el club del plantel.' };
  if (!category) return { error: 'Elegí la categoría.' };
  const same = (t) => { const n = normalizeCategory(t); return n.category.toLowerCase() === category.toLowerCase() && n.branch === branch; };
  if (siblings.some((t) => t.id !== draft.id && !t.deleted && t.clubId === draft.clubId && same(t))) {
    return { error: 'Ese club ya tiene un plantel ' + categoryLabel({ category, branch }) + '.' };
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
    clubId: draft.clubId, category, branch, coach: String(draft.coach || '').trim(),
    // La competición se elige en cada partido; el plantel solo recuerda la última.
    competition: '', periodMin: String(draft.periodMin || DEFAULT_PERIOD_MIN),
    players: players.map((p) => ({ id: p.id, num: String(p.num).trim(), name: String(p.name).trim(), active: p.active !== false }))
  };
  if (draft.isNew) doc.createdAt = now;
  return { doc };
}
