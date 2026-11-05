// Caso de uso: juntar los partidos (con sus jugadas) que entran en un informe.

import { hydrateGame } from '../domain/game.js';

/**
 * Partidos del informe según los filtros (sobre los datos de la lista, sin jugadas).
 * @param {object[]} games lista de partidos (state.games)
 * @param {{teamId: string|null, competitionId?: string, from?: string, to?: string}} f
 *   competitionId: '' = todas, 'none' = solo amistosos / sin competición
 */
export function filterReportGames(games, f) {
  return (games || []).filter((g) => {
    if (g.deleted || g.teamId !== f.teamId) return false;
    if (f.competitionId === 'none' && g.competitionId) return false;
    if (f.competitionId && f.competitionId !== 'none' && g.competitionId !== f.competitionId) return false;
    if (f.from && String(g.date || '') < f.from) return false;
    if (f.to && String(g.date || '') > f.to) return false;
    return true;
  });
}

/**
 * Lector de partidos completos con memoria: un partido ya leído no se vuelve a pedir
 * mientras no cambie (`updatedAt`).
 * @param {{loadGame: (id: string) => Promise<{game, events}>}} store
 */
export function createReportLoader(store) {
  const cache = new Map();
  return {
    /** @returns {Promise<object[]>} partidos con `events`, en el mismo orden; los que fallan se omiten */
    async load(list) {
      const out = await Promise.all(list.map(async (meta) => {
        const hit = cache.get(meta.id);
        if (hit && hit.updatedAt === (meta.updatedAt || 0)) return hit.game;
        try {
          const r = await store.loadGame(meta.id);
          const game = hydrateGame(r.game, r.events);
          cache.set(meta.id, { updatedAt: meta.updatedAt || 0, game });
          return game;
        } catch (e) {
          return null;
        }
      }));
      return out.filter(Boolean);
    },
    clear() { cache.clear(); }
  };
}
