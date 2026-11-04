// Controlador de «Mis partidos».

import { app, state, ui } from '../state.js';
import { render } from '../render.js';
import { reportSaveError } from '../toast.js';
import { persistView } from '../navigation.js';
import { editTeam } from './team-controller.js';
import { newSetup } from './setup-controller.js';

function deleteGame(id) {
  if (ui.confirm === 'gdel-' + id) {
    ui.confirm = null;
    app.store.saveGame(id, { deleted: true }).catch(reportSaveError);
  } else {
    ui.confirm = 'gdel-' + id;
    render();
  }
}

export const homeActions = {
  'new-setup': () => newSetup(),
  'new-team': () => editTeam(null, 'home'),
  // También se usa desde la previa: ahí edita el plantel elegido y vuelve a la previa.
  'edit-team': ({ id }) => {
    if (state.view === 'setup') { persistView(); editTeam(state.setup.teamId, 'setup'); }
    else editTeam(id || null, 'home');
  },
  'del-game': ({ id }) => deleteGame(id)
};
