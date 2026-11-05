// Lecturas derivadas del estado de la UI.

import { state } from './state.js';
import { resolveTeam } from '../domain/club.js';
import { sortCompetitions } from '../domain/competition.js';

/** Club por id, o null. */
export function clubById(id) {
  return (state.clubs || []).find((c) => c.id === id) || null;
}

/** Documento del plantel tal cual se guardó (para editarlo), o null. */
export function rawTeamById(id) {
  return (state.teams || []).find((t) => t.id === id) || null;
}

/** Plantel con los datos de su club (nombre, colores, estadios), o null. */
export function teamById(id) {
  const t = rawTeamById(id);
  return t ? resolveTeam(t, clubById(t.clubId)) : null;
}

const byLabel = (a, b) => (a.name.localeCompare(b.name, 'es') || a.category.localeCompare(b.category, 'es'));

/** Todos los planteles resueltos, por club y categoría. */
export function resolvedTeams() {
  return (state.teams || []).map((t) => resolveTeam(t, clubById(t.clubId))).sort(byLabel);
}

/** Planteles resueltos de un club. */
export function teamsOfClub(clubId) {
  return resolvedTeams().filter((t) => t.clubId === clubId);
}

/** Hay al menos un plantel cargado. */
export function hasTeams() {
  return (state.teams || []).length > 0;
}

/** Hay al menos un club cargado. */
export function hasClubs() {
  return (state.clubs || []).length > 0;
}

/** Competición por id (no borrada), o null. */
export function competitionById(id) {
  return (state.competitions || []).find((c) => c.id === id && !c.deleted) || null;
}

/** Competiciones, de la temporada más reciente a la más vieja. */
export function competitionsList() {
  return sortCompetitions(state.competitions);
}
