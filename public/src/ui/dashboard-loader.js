// Líderes del resumen de inicio: necesitan las jugadas, así que se leen los partidos terminados
// de la temporada (con memoria: un partido que no cambió no se vuelve a pedir).

import { app, state } from './state.js';
import { createReportLoader } from '../application/report-games.js';
import { dashboardScope, scopeGames, seasonLeaders } from '../domain/dashboard.js';

let loader = null;
let seq = 0;

/**
 * Recalcula los líderes si cambiaron los partidos de la temporada.
 * @param {() => void} onDone se llama cuando terminan de leerse (para re-dibujar)
 */
export function refreshDashboard(onDone) {
  if (!state.games || !app.store) return;
  const scope = dashboardScope(state.games);
  const list = scopeGames(state.games, scope).filter((g) => g.status === 'final');
  const key = (scope ? scope.teamId + '|' + scope.season : '') + '|' + list.map((g) => g.id + ':' + (g.updatedAt || 0)).join(',');
  if (state.dash && state.dash.key === key) return;
  if (!list.length) { state.dash = { key, leaders: seasonLeaders([]) }; return; }
  state.dash = { key, leaders: null };
  if (!loader) loader = createReportLoader(app.store);
  const my = ++seq;
  loader.load(list).then((games) => {
    if (my !== seq) return;
    state.dash = { key, leaders: seasonLeaders(games) };
    if (onDone) onDone();
  });
}

export function clearDashboard() {
  seq++;
  state.dash = null;
  if (loader) loader.clear();
}
