// Controlador de «Informes»: filtros, pestañas y lectura de los partidos.

import { app, state, resetUi } from '../state.js';
import { render } from '../render.js';
import { onKeydown } from '../events.js';
import { resolvedTeams } from '../selectors.js';
import { onFieldChange } from './form-controller.js';
import { filterReportGames, createReportLoader } from '../../application/report-games.js';

let loader = null;
let loadSeq = 0;

function focusId(id) {
  const el = document.getElementById(id);
  if (el) el.focus();
}

/** Vuelve a juntar los partidos según los filtros y re-dibuja. */
function reload() {
  const f = state.reports;
  if (!f.teamId) { state.reportGames = []; render(); return; }
  if (!loader) loader = createReportLoader(app.store);
  const my = ++loadSeq;
  state.reportGames = null;
  render();
  loader.load(filterReportGames(state.games, f)).then((games) => {
    if (my !== loadSeq || state.view !== 'reports') return;
    state.reportGames = games;
    // Si el jugador elegido no aparece en estos partidos, se vuelve a todo el equipo.
    if (f.playerId && !games.some((g) => (g.roster || []).some((p) => p.id === f.playerId))) f.playerId = '';
    const keep = document.activeElement && document.activeElement.id;
    render();
    if (keep) focusId(keep);
  });
}

/** Plantel con el que abre: el del último partido, si no el primero. */
function defaultTeamId() {
  const teams = resolvedTeams();
  const last = (state.games || []).find((g) => teams.some((t) => t.id === g.teamId));
  return last ? last.teamId : (teams[0] ? teams[0].id : null);
}

export function openReports() {
  const prev = state.reports;
  const teamId = prev && resolvedTeams().some((t) => t.id === prev.teamId) ? prev.teamId : defaultTeamId();
  state.reports = prev && prev.teamId === teamId ? prev :
    { teamId, playerId: '', competitionId: '', from: '', to: '', tab: 'shots', mode: 'pct', stat: 'pts' };
  state.view = 'reports';
  resetUi();
  reload();
  focusId('rep-h1');
}

const inReports = (fn) => (form) => { if (state.view === 'reports') fn(form); };

onFieldChange('teamId', inReports((f) => { f.playerId = ''; reload(); focusId('f-rteam'); }));
onFieldChange('competitionId', inReports(() => { reload(); focusId('f-rcomp'); }));
onFieldChange('from', inReports(() => { reload(); focusId('f-rfrom'); }));
onFieldChange('to', inReports(() => { reload(); focusId('f-rto'); }));
onFieldChange('playerId', inReports(() => { render(); focusId('f-rplayer'); }));
onFieldChange('stat', inReports(() => { render(); focusId('f-rstat'); }));

function selectTab(tab) {
  state.reports.tab = tab === 'progress' ? 'progress' : 'shots';
  render();
  focusId('rt-' + state.reports.tab);
}

/** Pestañas: flechas izquierda/derecha, Inicio y Fin. */
function tabKeys(event) {
  if (state.view !== 'reports' || !(event.target.getAttribute && event.target.getAttribute('role') === 'tab')) return false;
  const order = ['shots', 'progress'], i = order.indexOf(state.reports.tab);
  const next = { ArrowRight: order[(i + 1) % 2], ArrowLeft: order[(i + 1) % 2], Home: order[0], End: order[1] }[event.key];
  if (!next) return false;
  event.preventDefault();
  selectTab(next);
  return true;
}
onKeydown(tabKeys);

export const reportsActions = {
  'open-reports': () => openReports(),
  'rep-tab': ({ data }) => selectTab(data.v),
  'rep-mode': ({ data }) => {
    state.reports.mode = data.v === 'volume' ? 'volume' : 'pct';
    render();
  }
};
