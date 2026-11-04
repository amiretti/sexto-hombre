// Club: nombre, colores (titular y alternativo) y estadios. Agrupa uno o más planteles (categorías).

import { newId, shortId } from '../shared/ids.js';
import { DEFAULT_TEAM_COLOR, safeColor } from '../shared/colors.js';

export const MAX_VENUES_PER_CLUB = 10;
export const DEFAULT_ALT_COLOR = '#ffffff';
/** Categoría con la que quedan los planteles creados antes de que existieran los clubes. */
export const MIGRATED_CATEGORY = 'Primera';

const norm = (s) => String(s || '').trim().toLowerCase();

/* ---------- estadios (dónde jugamos de local) ---------- */

export function newDraftVenue() {
  return { id: shortId(), name: '', location: '' };
}

/** Estadios cargados (con nombre) de un club o de un plantel ya resuelto. */
export function venuesOf(x) {
  return ((x && x.venues) || []).filter((v) => v && v.id && String(v.name || '').trim());
}

/** Marca (o desmarca, si ya lo era) el estadio por defecto del borrador. Muta `draft`. */
export function toggleDefaultVenue(draft, venueId) {
  draft.defaultVenueId = draft.defaultVenueId === venueId ? null : venueId;
}

/* ---------- borradores ---------- */

export function blankClubDraft() {
  return { id: newId(), isNew: true, name: '', color: DEFAULT_TEAM_COLOR, altColor: DEFAULT_ALT_COLOR, venues: [newDraftVenue()], defaultVenueId: null };
}

/** Copia editable de un club guardado: siempre con al menos una fila de estadio para completar. */
export function editableClubDraft(club) {
  const draft = JSON.parse(JSON.stringify(club));
  draft.venues = Array.isArray(draft.venues) && draft.venues.length ? draft.venues : [newDraftVenue()];
  draft.altColor = draft.altColor || DEFAULT_ALT_COLOR;
  return draft;
}

/**
 * Primer club del usuario: el del último partido (versiones anteriores), el de ejemplo en demo, o vacío.
 * @param {object|null} profile perfil del usuario (puede traer `lastSetup`)
 * @param {boolean} demo
 */
export function seedClubDraft(profile, demo) {
  const last = profile && profile.lastSetup;
  if (last && last.team) return Object.assign(blankClubDraft(), { seeded: 'last', name: last.team, color: safeColor(last.teamColor, DEFAULT_TEAM_COLOR) });
  if (demo) {
    return Object.assign(blankClubDraft(), {
      seeded: 'example', name: 'Unión Central',
      venues: [
        { id: 'v-principal', name: 'Estadio Unión Central', location: 'Av. San Martín 1450, Rafaela' },
        { id: 'v-auxiliar', name: 'Cancha auxiliar', location: 'Bv. Lehmann 300, Rafaela' }
      ],
      defaultVenueId: 'v-principal'
    });
  }
  return blankClubDraft();
}

/**
 * Valida el borrador y arma el documento a guardar.
 * @param {object[]} [others] los demás clubes del usuario (para no repetir nombres)
 * @returns {{error: string} | {doc: object}}
 */
export function buildClubDocument(draft, others = [], now = Date.now()) {
  const name = String(draft.name || '').trim();
  if (!name) return { error: 'Falta el nombre del club.' };
  if (others.some((c) => c.id !== draft.id && norm(c.name) === norm(name))) return { error: 'Ya tenés un club llamado «' + name + '».' };
  const venues = (draft.venues || [])
    .map((v) => ({ id: v.id, name: String(v.name || '').trim(), location: String(v.location || '').trim() }))
    .filter((v) => v.name || v.location);
  const venueNames = {};
  for (const v of venues) {
    if (!v.name || !v.location) return { error: 'Cada estadio necesita nombre y ubicación.' };
    const key = norm(v.name);
    if (venueNames[key]) return { error: 'Hay dos estadios llamados «' + v.name + '».' };
    venueNames[key] = 1;
  }
  if (venues.length > MAX_VENUES_PER_CLUB) return { error: 'Se pueden cargar hasta ' + MAX_VENUES_PER_CLUB + ' estadios.' };
  const doc = {
    name, color: safeColor(draft.color, DEFAULT_TEAM_COLOR), altColor: safeColor(draft.altColor, DEFAULT_ALT_COLOR), venues,
    // Estadio que se propone al jugar de local (si se borró, no queda ninguno por defecto).
    defaultVenueId: venues.some((v) => v.id === draft.defaultVenueId) ? draft.defaultVenueId : null
  };
  if (draft.isNew) doc.createdAt = now;
  return { doc };
}

/* ---------- plantel + club ---------- */

/**
 * Plantel con los datos de su club (nombre, colores, estadios). Sin club (datos de antes de los clubes)
 * usa los que tenía el propio plantel.
 */
export function resolveTeam(team, club) {
  if (!team) return null;
  const src = club || team;
  return Object.assign({}, team, {
    clubId: club ? club.id : team.clubId || null,
    name: src.name || team.name || '',
    category: String(team.category || ''),
    color: src.color || DEFAULT_TEAM_COLOR,
    altColor: club ? club.altColor || '' : '',
    venues: src.venues || [],
    defaultVenueId: src.defaultVenueId || null
  });
}

/** "Unión Central · U17" (o solo el club si no hay categoría). */
export function teamLabel(team, sep = ' · ') {
  if (!team) return '';
  return team.category ? team.name + sep + team.category : team.name;
}

/**
 * Planteles creados antes de los clubes (sin `clubId`): se agrupan por nombre en un club con ese nombre,
 * su color y sus estadios. Si ya existe un club con ese nombre, se suman a ese.
 * @returns {{clubs: {id: string, doc: object}[], teams: {id: string, patch: object}[]}}
 */
export function planClubMigration(teams, clubs, makeId = newId, now = Date.now()) {
  const plan = { clubs: [], teams: [] };
  const byName = new Map((clubs || []).map((c) => [norm(c.name), { id: c.id, categories: new Set() }]));
  (teams || []).filter((t) => t.clubId).forEach((t) => {
    const c = [...byName.values()].find((x) => x.id === t.clubId);
    if (c) c.categories.add(norm(t.category));
  });
  for (const t of teams || []) {
    if (t.clubId || t.deleted) continue;
    const key = norm(t.name) || '—';
    let target = byName.get(key);
    if (!target) {
      target = { id: makeId(), categories: new Set(), doc: { name: String(t.name || '').trim() || 'Mi club', color: safeColor(t.color, DEFAULT_TEAM_COLOR), altColor: DEFAULT_ALT_COLOR, venues: [], defaultVenueId: null, createdAt: now } };
      byName.set(key, target);
      plan.clubs.push({ id: target.id, doc: target.doc });
    }
    if (target.doc) {
      // Estadios de todos los planteles del grupo, sin repetir nombre.
      for (const v of venuesOf(t)) {
        if (!target.doc.venues.some((x) => norm(x.name) === norm(v.name))) target.doc.venues.push({ id: v.id, name: v.name, location: v.location || '' });
      }
      if (!target.doc.defaultVenueId && target.doc.venues.some((v) => v.id === t.defaultVenueId)) target.doc.defaultVenueId = t.defaultVenueId;
    }
    let category = String(t.category || '').trim() || MIGRATED_CATEGORY, n = 2;
    const base = category;
    while (target.categories.has(norm(category))) category = base + ' ' + n++;
    target.categories.add(norm(category));
    plan.teams.push({ id: t.id, patch: { clubId: target.id, category } });
  }
  return plan;
}
