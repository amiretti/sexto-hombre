// Controlador de la previa del partido.

import {
  blankSetup, applyTeamToSetup, reconcileSelection, toggleCalled, toggleStarter, createGame, SETUP_VERSION
} from '../../domain/game-setup.js';
import { loadSetupDraft, clearSetupDraft } from '../../infrastructure/platform/setup-draft-storage.js';
import { app, state, ui } from '../state.js';
import { render } from '../render.js';
import { focusId } from '../dom.js';
import { teamById } from '../selectors.js';
import { persistView, showGame } from '../navigation.js';
import { editTeam } from './team-controller.js';

const uid = () => state.user && state.user.uid;

/** Borrador guardado si es de esta versión, sin planteles que ya no existen. */
function restoredDraft() {
  const d = loadSetupDraft(uid());
  if (!(d && d.v === SETUP_VERSION)) return null;
  if (d.teamId && !teamById(d.teamId)) d.teamId = null;
  return d;
}

/**
 * Abre la previa de un partido nuevo, retomando el borrador si corresponde.
 * @param {string} [teamId] plantel preelegido
 */
export function newSetup(teamId) {
  if (state.teams === null) return;
  if (!state.teams.length) { editTeam(null, 'setup'); return; }
  const draft = restoredDraft();
  state.setup = draft && (!teamId || draft.teamId === teamId || !draft.teamId) ? draft : blankSetup();
  const s = state.setup;
  const tid = teamId || s.teamId || (state.teams.length === 1 ? state.teams[0].id : null);
  if (tid && tid !== s.teamId) applyTeamToSetup(s, teamById(tid));
  else reconcileSelection(s, teamById(s.teamId));
  state.view = 'setup';
  ui.setupErr = '';
  ui.colorOpen = null;
  persistView();
  render();
  if (s.teamId) focusId('f-opp');
}

/** Lleva el foco al campo del error de la previa (o al mensaje). */
function focusInvalid(error) {
  const field = /rival/i.test(error) ? document.getElementById('f-opp') : null;
  if (field) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', 'setup-err'); field.focus(); return; }
  const msg = document.getElementById('setup-err');
  if (msg) { msg.tabIndex = -1; msg.focus(); }
}

function startGame() {
  const team = teamById(state.setup.teamId);
  const result = createGame(state.setup, team);
  if (result.error) { ui.setupErr = result.error; render(); focusInvalid(result.error); return; }
  showGame(result.game);
  app.session.persistNow();
  app.lock.acquire(result.game.id);
  app.store.saveTeam(team.id, { lastStarters: result.starters }).catch(() => {});
  clearSetupDraft(uid());
}

/** Cambia la previa, la guarda y vuelve a dibujar. */
const update = (fn) => (ctx) => { fn(state.setup, ctx); persistView(); render(); };

export const setupActions = {
  'pick-team': ({ id }) => {
    applyTeamToSetup(state.setup, teamById(id));
    persistView();
    render();
    focusId('f-opp');
  },
  'change-team': update((s) => { s.teamId = null; }),
  'venue': update((s, { data }) => { s.venue = data.v; }),
  'attack': update((s, { data }) => { s.attack = data.v === 'left' ? 'left' : 'right'; }),
  'call': update((s, { id }) => toggleCalled(s, id)),
  'starter': ({ id }) => {
    if (toggleStarter(state.setup, id)) { persistView(); render(); }
  },
  'start': () => startGame()
};
