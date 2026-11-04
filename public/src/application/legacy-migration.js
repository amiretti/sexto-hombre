// Migración de datos de versiones anteriores: planteles sin club (domain/club planClubMigration) y
// competiciones guardadas como texto en el plantel (domain/competition planCompetitionMigration).

import { planClubMigration } from '../domain/club.js';
import { planCompetitionMigration } from '../domain/competition.js';

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

/**
 * Crea las competiciones que estaban como texto en los planteles y deja a cada plantel recordándola.
 * Idempotente igual que migrateLegacyTeams (`done` son ids de planteles).
 * @returns {{competitions: object[], teams: object[]}}
 */
export function migrateLegacyCompetitions(store, teams, competitions, done, onError = () => {}) {
  const pendingTeams = (teams || []).filter((t) => t.competition && !done.has(t.id));
  if (!pendingTeams.length || !competitions) return { competitions: [], teams: [] };
  const plan = planCompetitionMigration(pendingTeams, competitions);
  plan.teams.forEach((t) => done.add(t.id));
  plan.competitions.forEach((c) => store.saveCompetition(c.id, c.doc).catch(onError));
  plan.teams.forEach((t) => store.saveTeam(t.id, t.patch).catch(onError));
  return plan;
}
