// Resumen de la temporada para el inicio: partido en curso, últimos resultados, récord y líderes.
// Récord y resultados salen de la lista de partidos (resumen del tanteador); los líderes necesitan las jugadas.

import { playerStats } from './stats.js';
import { chronological } from './player-progress.js';

const score = (g) => ({ us: Number(g.summary && g.summary.us) || 0, them: Number(g.summary && g.summary.them) || 0 });

/** Resultado de un partido terminado: 'W' | 'L' | 'T'. */
export function outcome(game) {
  const s = score(game);
  return s.us > s.them ? 'W' : s.us < s.them ? 'L' : 'T';
}

/** Año de la temporada de un partido (de su fecha AAAA-MM-DD). */
export const seasonOf = (game) => String(game.date || '').slice(0, 4);

/**
 * Plantel y temporada del resumen: los del partido más reciente.
 * @returns {{teamId: string|null, season: string}|null}
 */
export function dashboardScope(games) {
  const list = chronological((games || []).filter((g) => !g.deleted));
  const last = list[list.length - 1];
  return last ? { teamId: last.teamId || null, season: seasonOf(last) } : null;
}

/** Partidos del plantel en esa temporada (sin borrados). */
export function scopeGames(games, scope) {
  if (!scope) return [];
  return (games || []).filter((g) => !g.deleted && (g.teamId || null) === scope.teamId && seasonOf(g) === scope.season);
}

/** Partidos sin terminar, el más reciente primero. */
export function liveGames(games) {
  return chronological((games || []).filter((g) => !g.deleted && g.status !== 'final')).reverse();
}

/** Últimos `n` partidos terminados, el más reciente primero. */
export function recentResults(games, n = 5) {
  return chronological((games || []).filter((g) => !g.deleted && g.status === 'final')).reverse().slice(0, n);
}

/**
 * Récord de partidos terminados.
 * @returns {{played, won, lost, tied, ptsFor: number|null, ptsAgainst: number|null}} promedios con un decimal
 */
export function seasonRecord(games) {
  const done = (games || []).filter((g) => !g.deleted && g.status === 'final');
  const r = { played: done.length, won: 0, lost: 0, tied: 0, ptsFor: null, ptsAgainst: null };
  let pf = 0, pa = 0;
  for (const g of done) {
    const o = outcome(g), s = score(g);
    if (o === 'W') r.won++; else if (o === 'L') r.lost++; else r.tied++;
    pf += s.us; pa += s.them;
  }
  if (done.length) { r.ptsFor = avg(pf, done.length); r.ptsAgainst = avg(pa, done.length); }
  return r;
}

const avg = (total, n) => Math.round(total * 10 / n) / 10;

/** Categorías de líderes. */
export const LEADER_STATS = [
  { id: 'pts', label: 'Puntos', short: 'PTS', get: (s) => s.pts },
  { id: 'reb', label: 'Rebotes', short: 'REB', get: (s) => s.ro + s.rd },
  { id: 'ast', label: 'Asistencias', short: 'AST', get: (s) => s.ast }
];

/**
 * Líderes por promedio en los partidos en los que el jugador fue convocado.
 * @param {object[]} games partidos con `events` y `roster`
 * @param {number} [top] cuántos por categoría
 * @returns {{stat, leaders: {id, num, name, games, total, average}[]}[]} sin los que suman 0
 */
export function seasonLeaders(games, top = 3) {
  const players = new Map();
  for (const game of chronological(games || [])) {
    for (const p of game.roster || []) {
      const s = playerStats(game, p.id);
      const cur = players.get(p.id) || { id: p.id, games: 0, totals: {} };
      cur.num = p.num; cur.name = p.name; cur.games++;
      for (const st of LEADER_STATS) cur.totals[st.id] = (cur.totals[st.id] || 0) + st.get(s);
      players.set(p.id, cur);
    }
  }
  const all = [...players.values()];
  return LEADER_STATS.map((stat) => ({
    stat,
    leaders: all.filter((p) => p.totals[stat.id] > 0)
      .map((p) => ({ id: p.id, num: p.num, name: p.name, games: p.games, total: p.totals[stat.id], average: avg(p.totals[stat.id], p.games) }))
      .sort((a, b) => b.average - a.average || b.total - a.total || String(a.name).localeCompare(String(b.name), 'es'))
      .slice(0, top)
  }));
}
