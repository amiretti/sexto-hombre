// Progreso partido a partido: una estadística por partido, de un jugador o de todo el equipo.

import { playerStats, teamTotals } from './stats.js';
import { formatMinutes } from './playing-time.js';

/**
 * Estadísticas que se pueden seguir. `pct` = porcentaje (sin intentos el partido no suma punto).
 * `get(s)` recibe la planilla del jugador (playerStats) o los totales del equipo (teamTotals).
 * `playerOnly` = no tiene sentido para el equipo (los minutos del equipo son siempre los del partido × 5).
 */
export const PROGRESS_STATS = [
  { id: 'pts', label: 'Puntos', get: (s) => s.pts },
  { id: 'min', label: 'Minutos jugados', playerOnly: true, get: (s) => Math.round(s.sec / 6) / 10, detail: (s) => formatMinutes(s.sec) },
  { id: 'reb', label: 'Rebotes', get: (s) => s.ro + s.rd },
  { id: 'ast', label: 'Asistencias', get: (s) => s.ast },
  { id: 'stl', label: 'Robos', get: (s) => s.stl },
  { id: 'blk', label: 'Tapones', get: (s) => s.blk },
  { id: 'tov', label: 'Pérdidas', get: (s) => s.tov },
  { id: 'fouls', label: 'Faltas cometidas', get: (s) => s.fouls },
  { id: 'fd', label: 'Faltas recibidas', get: (s) => s.fd },
  { id: 'ro', label: 'Rebotes ofensivos', get: (s) => s.ro },
  { id: 'rd', label: 'Rebotes defensivos', get: (s) => s.rd },
  { id: 'm3', label: 'Triples convertidos', get: (s) => s.m3 },
  { id: 'fg', label: '% tiros de campo', pct: true, get: (s) => ratio(s.m2 + s.m3, s.a2 + s.a3), detail: (s) => (s.m2 + s.m3) + '/' + (s.a2 + s.a3) },
  { id: 'p3', label: '% triples', pct: true, get: (s) => ratio(s.m3, s.a3), detail: (s) => s.m3 + '/' + s.a3 },
  { id: 'ft', label: '% tiros libres', pct: true, get: (s) => ratio(s.ftm, s.fta), detail: (s) => s.ftm + '/' + s.fta }
];

function ratio(made, att) {
  return att ? Math.round(made * 1000 / att) / 10 : null;
}

export function progressStat(id) {
  return PROGRESS_STATS.find((s) => s.id === id) || PROGRESS_STATS[0];
}

/** Orden cronológico de partidos (fecha y, a igual fecha, cuándo se creó). */
export function chronological(games) {
  return games.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * Serie de una estadística.
 * @param {object[]} games partidos con `events` y `roster`
 * @param {string|null} playerId null = todo el equipo
 * @param {string} statId
 * @returns {{stat: object, points: {gameId, date, opponent, value: number|null, detail: string}[], average: number|null}}
 *   Solo entran los partidos en los que el jugador estuvo convocado.
 */
export function playerSeries(games, playerId, statId) {
  const stat = progressStat(statId);
  const points = [];
  for (const game of chronological(games)) {
    if (playerId && !(game.roster || []).some((p) => p.id === playerId)) continue;
    const s = playerId ? playerStats(game, playerId) : teamTotals(game);
    const skip = stat.playerOnly && !playerId;
    points.push({
      gameId: game.id, date: game.date || '', opponent: game.opponent || '',
      value: skip ? null : stat.get(s), detail: skip || !stat.detail ? '' : stat.detail(s)
    });
  }
  const values = points.map((p) => p.value).filter((v) => v != null);
  const average = values.length ? Math.round(values.reduce((a, b) => a + b, 0) * 10 / values.length) / 10 : null;
  return { stat, points, average };
}

/**
 * Jugadores que aparecen en los partidos (por id), con el último número y nombre usados.
 * @returns {{id, num, name, games: number}[]} ordenados por número
 */
export function playersInGames(games) {
  const map = new Map();
  for (const game of chronological(games)) {
    for (const p of game.roster || []) {
      const prev = map.get(p.id);
      map.set(p.id, { id: p.id, num: p.num, name: p.name, games: (prev ? prev.games : 0) + 1 });
    }
  }
  return [...map.values()].sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0) || String(a.name).localeCompare(String(b.name), 'es'));
}
