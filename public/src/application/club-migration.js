// Migración de planteles creados antes de que existieran los clubes (ver domain/club planClubMigration).

import { planClubMigration } from '../domain/club.js';

/**
 * Crea los clubes que falten y asigna cada plantel suelto a su club. Es idempotente: los planteles que
 * ya tienen club, o que ya se migraron en esta sesión, no se tocan.
 * @param {{saveClub: Function, saveTeam: Function}} store
 * @param {Set<string>} done ids de planteles ya migrados en esta sesión
 * @returns {{clubs: object[], teams: object[]}} lo que se guardó (para reflejarlo en pantalla sin esperar)
 */
export function migrateLegacyTeams(store, teams, clubs, done, onError = () => {}) {
  const pendingTeams = (teams || []).filter((t) => !t.clubId && !done.has(t.id));
  if (!pendingTeams.length || !clubs) return { clubs: [], teams: [] };
  // Para no repetir categorías, el plan necesita también los planteles que ya tienen club.
  const plan = planClubMigration(pendingTeams.concat((teams || []).filter((t) => t.clubId)), clubs);
  // Se marcan antes de guardar: el store puede avisar de los cambios en el acto y volver a llamarnos.
  plan.teams.forEach((t) => done.add(t.id));
  plan.clubs.forEach((c) => store.saveClub(c.id, c.doc).catch(onError));
  plan.teams.forEach((t) => store.saveTeam(t.id, t.patch).catch(onError));
  return plan;
}
