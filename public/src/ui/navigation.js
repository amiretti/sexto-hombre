// Navegación entre pantallas y ciclo de sesión del usuario.

import { app, state, ui, resetUi, currentGame } from './state.js';
import { render } from './render.js';
import { toast } from './toast.js';
import { hydrateGame } from '../domain/game.js';
import { saveSetupDraft } from '../infrastructure/platform/setup-draft-storage.js';
import { keepScreenOn } from '../infrastructure/platform/device.js';

let unwatch = null;
let authSeq = 0;

/** Guarda lo que haya que guardar de la pantalla actual (borrador de previa o partido). */
export function persistView() {
  if (state.view === 'setup' && state.setup) saveSetupDraft(state.user && state.user.uid, state.setup);
  if (state.view === 'game' && currentGame()) app.session.schedulePersist();
}

function watchUserData() {
  if (unwatch || !state.user) return;
  const uid = state.user.uid;
  const offGames = app.store.watchGames(uid, (list, fromCache, err) => {
    if (err) state.gamesErr = 'No se pudieron leer los partidos (' + (err.code || err.message) + ').';
    else { state.games = list; state.gamesErr = ''; }
    if (state.view === 'home') render();
  });
  const offTeams = app.store.watchTeams(uid, (list, err) => {
    if (err) { state.teams = state.teams || []; state.gamesErr = 'No se pudieron leer los planteles (' + (err.code || err.message) + ').'; }
    else state.teams = list;
    if (state.view === 'home') render();
  });
  unwatch = () => { offGames(); offTeams(); };
}

export function stopWatching() {
  if (unwatch) { unwatch(); unwatch = null; }
  state.teams = null;
}

export function goHome() {
  app.session.close();
  state.view = 'home';
  resetUi();
  watchUserData();
  render();
}

/** Muestra el partido ya armado en memoria (recién creado o leído). */
export function showGame(game) {
  app.session.open(game);
  state.view = 'game';
  resetUi();
  render();
  keepScreenOn();
}

export function openGame(id) {
  state.view = 'loading';
  render();
  app.store.loadGame(id).then((r) => {
    showGame(hydrateGame(r.game, r.events));
  }).catch((e) => {
    state.view = 'home';
    state.gamesErr = 'No se pudo abrir el partido: ' + (e.message || e);
    render();
  });
}

/** Cambió la sesión (login, logout o reintento de lista blanca). */
export function onUser(user) {
  const my = ++authSeq;
  if (!user) {
    stopWatching();
    app.session.close();
    state.user = null; state.games = null; state.view = 'login';
    resetUi(); render();
    return;
  }
  state.user = user;
  state.view = 'boot';
  render();
  app.store.isAllowed(user).then((ok) => {
    if (my !== authSeq) return;
    if (!ok) { state.view = 'denied'; render(); return; }
    app.store.getProfile(user.uid).then((p) => { state.profile = p || {}; });
    state.games = null;
    goHome();
  });
}

/** Acciones comunes a todas las pantallas. */
export const navigationActions = {
  'go-home': () => goHome(),
  'open-game': ({ id }) => openGame(id),
  'login': () => {
    ui.authErr = '';
    app.store.signIn().catch((e) => { ui.authErr = 'No se pudo ingresar: ' + (e.code || e.message); render(); });
  },
  'logout': () => {
    // Al salir se borran los datos del dispositivo: lo que no llegó al servidor se perdería.
    if (state.pending > 0 && ui.confirm !== 'logout') {
      ui.confirm = 'logout';
      toast('Hay ' + state.pending + ' cambios sin enviar. Si salís ahora se pierden. Tocá «Salir» de nuevo para salir igual.', true);
      return;
    }
    stopWatching();
    app.session.close();
    app.store.signOut().finally(() => location.reload());
  },
  'retry-allow': () => onUser(state.user)
};
