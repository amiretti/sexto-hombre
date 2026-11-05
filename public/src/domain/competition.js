// Competición (liga, torneo): nombre, temporada y duración del cuarto. Se elige al crear el partido.

import { newId } from '../shared/ids.js';
import { DEFAULT_PERIOD_MIN } from './team.js';

export const PERIOD_LENGTHS = ['10', '12', '8', '6'];

const norm = (s) => String(s || '').trim().toLowerCase();
const currentSeason = (now = Date.now()) => String(new Date(now).getFullYear());

export function blankCompetitionDraft(now = Date.now()) {
  return { id: newId(), isNew: true, name: '', season: currentSeason(now), periodMin: DEFAULT_PERIOD_MIN };
}

export function editableCompetitionDraft(c) {
  return JSON.parse(JSON.stringify(c));
}

/** "Liga del Oeste 2026" (o solo el nombre si no hay temporada). */
export function competitionLabel(c) {
  if (!c) return '';
  return [String(c.name || '').trim(), String(c.season || '').trim()].filter(Boolean).join(' ');
}

/** Más reciente primero; dentro de la temporada, por nombre. */
export function sortCompetitions(list) {
  return (list || []).filter((c) => !c.deleted).slice()
    .sort((a, b) => String(b.season || '').localeCompare(String(a.season || '')) || String(a.name || '').localeCompare(String(b.name || ''), 'es'));
}

/**
 * Valida el borrador y arma el documento a guardar.
 * @param {object[]} [others] las demás competiciones (no se repite nombre + temporada)
 * @returns {{error: string} | {doc: object}}
 */
export function buildCompetitionDocument(draft, others = [], now = Date.now()) {
  const name = String(draft.name || '').trim();
  const season = String(draft.season || '').trim();
  if (!name) return { error: 'Falta el nombre de la competición.' };
  if (season && !/^\d{4}(\/\d{2,4})?$/.test(season)) return { error: 'La temporada va como año (2026) o 2026/27.' };
  if (others.some((c) => c.id !== draft.id && !c.deleted && norm(c.name) === norm(name) && norm(c.season) === norm(season))) {
    return { error: 'Ya tenés «' + competitionLabel({ name, season }) + '».' };
  }
  const periodMin = PERIOD_LENGTHS.includes(String(draft.periodMin)) ? String(draft.periodMin) : DEFAULT_PERIOD_MIN;
  const doc = { name, season, periodMin };
  if (draft.isNew) doc.createdAt = now;
  return { doc };
}

/**
 * Planteles de antes con la competición como texto: se crea una competición por nombre (temporada actual,
 * duración del plantel) y el plantel la recuerda como última usada.
 * @returns {{competitions: {id: string, doc: object}[], teams: {id: string, patch: object}[]}}
 */
export function planCompetitionMigration(teams, competitions, makeId = newId, now = Date.now()) {
  const plan = { competitions: [], teams: [] };
  const byName = new Map(sortCompetitions(competitions).map((c) => [norm(c.name), c.id]));
  for (const t of teams || []) {
    const name = String(t.competition || '').trim();
    if (t.deleted || !name) continue;
    let id = byName.get(norm(name));
    if (!id) {
      id = makeId();
      byName.set(norm(name), id);
      plan.competitions.push({ id, doc: { name, season: currentSeason(now), periodMin: PERIOD_LENGTHS.includes(String(t.periodMin)) ? String(t.periodMin) : DEFAULT_PERIOD_MIN, createdAt: now } });
    }
    plan.teams.push({ id: t.id, patch: { competition: '', lastCompetitionId: t.lastCompetitionId || id } });
  }
  return plan;
}
