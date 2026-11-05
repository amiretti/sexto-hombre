// Controlador del inicio: secciones, partidos y planteles.

import { app, state, ui } from '../state.js';
import { render } from '../render.js';
import { reportSaveError, toast } from '../toast.js';
import { persistView, refreshHomeDashboard } from '../navigation.js';
import { HOME_TABS } from '../views/home-view.js';
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

/** Borrado al deslizar la tarjeta: sin segundo toque, pero el aviso permite deshacerlo. */
function swipeDeleteGame(id) {
  ui.confirm = null;
  app.store.saveGame(id, { deleted: true }).catch(reportSaveError);
  toast('Partido borrado', false, null, { label: 'Deshacer', a: 'undel-game', id });
}

function restoreGame(id) {
  app.store.saveGame(id, { deleted: false }).catch(reportSaveError);
  toast('Partido recuperado');
}

/** Cambia de sección del inicio y deja el foco en su título. */
function selectHomeTab(tab) {
  if (!HOME_TABS.some((t) => t.id === tab)) return;
  state.homeTab = tab;
  ui.confirm = null;
  refreshHomeDashboard();
  render();
  window.scrollTo(0, 0);
  const h1 = document.getElementById('home-h1');
  if (h1) h1.focus({ preventScroll: true });
}

export const homeActions = {
  'home-tab': ({ data }) => selectHomeTab(data.v),
  'new-setup': () => newSetup(),
  'new-team': ({ id }) => editTeam(null, 'home', id || null),
  // También se usa desde la previa: ahí edita el plantel elegido y vuelve a la previa.
  'edit-team': ({ id }) => {
    if (state.view === 'setup') { persistView(); editTeam(state.setup.teamId, 'setup'); }
    else editTeam(id || null, 'home');
  },
  'del-game': ({ id }) => deleteGame(id),
  'swipe-del-game': ({ id }) => swipeDeleteGame(id),
  'undel-game': ({ id }) => restoreGame(id)
};
