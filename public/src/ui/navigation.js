// Navegación entre pantallas y ciclo de sesión del usuario.

import { app, state, ui, resetUi, currentGame } from './state.js';
import { render } from './render.js';
import { toast } from './toast.js';
import { isSunMode, setSunMode } from '../infrastructure/platform/theme.js';
import { hydrateGame } from '../domain/game.js';
import { saveSetupDraft } from '../infrastructure/platform/setup-draft-storage.js';
import { keepScreenOn } from '../infrastructure/platform/device.js';
import { migrateLegacyTeams, migrateLegacyCompetitions } from '../application/legacy-migration.js';
import { reportSaveError } from './toast.js';

let unwatch = null;
let authSeq = 0;
/** Planteles ya asignados a un club en esta sesión (migración de datos viejos). */
const migrated = new Set();
const migratedCompetitions = new Set();

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
    onClubsOrTeams();
  });
  const offClubs = app.store.watchClubs(uid, (list, err) => {
    if (err) { state.clubs = state.clubs || []; state.gamesErr = 'No se pudieron leer los clubes (' + (err.code || err.message) + ').'; }
    else state.clubs = list;
    onClubsOrTeams();
  });
  const offCompetitions = app.store.watchCompetitions(uid, (list, err) => {
    if (err) { state.competitions = state.competitions || []; state.gamesErr = 'No se pudieron leer las competiciones (' + (err.code || err.message) + ').'; }
    else state.competitions = list;
    onClubsOrTeams();
  });
  unwatch = () => { offGames(); offTeams(); offClubs(); offCompetitions(); };
}

/** Con planteles y clubes leídos, los planteles viejos (sin club) pasan a su club. */
function onClubsOrTeams() {
  if (state.teams && state.clubs) {
    const plan = migrateLegacyTeams(app.store, state.teams, state.clubs, migrated, reportSaveError);
    // Se reflejan sin esperar al store (si ya avisó, no se duplican).
    plan.clubs.forEach((c) => { if (!state.clubs.some((x) => x.id === c.id)) state.clubs = state.clubs.concat({ id: c.id, ...c.doc }); });
    plan.teams.forEach((p) => { state.teams = state.teams.map((t) => (t.id === p.id ? { ...t, ...p.patch } : t)); });
  }
  if (state.teams && state.competitions) {
    const plan = migrateLegacyCompetitions(app.store, state.teams, state.competitions, migratedCompetitions, reportSaveError);
    plan.competitions.forEach((c) => { if (!state.competitions.some((x) => x.id === c.id)) state.competitions = state.competitions.concat({ id: c.id, ...c.doc }); });
    plan.teams.forEach((p) => { state.teams = state.teams.map((t) => (t.id === p.id ? { ...t, ...p.patch } : t)); });
  }
  if (state.view === 'home') render();
}

export function stopWatching() {
  if (unwatch) { unwatch(); unwatch = null; }
  state.teams = null;
  state.clubs = null;
  state.competitions = null;
}

export function goHome() {
  app.session.close();
  app.lock.release();
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

/**
 * Abre un partido guardado. Si otro dispositivo lo tiene abierto, muestra el aviso (salvo `force`).
 */
export function openGame(id, force = false) {
  state.view = 'loading';
  render();
  app.store.loadGame(id).then(async (r) => {
    const claim = await app.lock.acquire(id, force);
    if (!claim.ok) {
      state.lockInfo = { gameId: id, holder: claim.holder, team: r.game.team, opponent: r.game.opponent };
      state.view = 'locked';
      render();
      return;
    }
    state.lockInfo = null;
    showGame(hydrateGame(r.game, r.events));
  }).catch((e) => {
    state.view = 'home';
    state.gamesErr = 'No se pudo abrir el partido: ' + (e.message || e);
    render();
  });
}

/** Otro dispositivo tomó el partido: dejamos de guardar y volvemos al inicio. */
export function onGameTakenOver(holder) {
  app.session.abandon();
  goHome();
  toast('Este partido se abrió en ' + ((holder && holder.label) || 'otro dispositivo') + '. Desde acá ya no se guardan cambios.', true);
}

/** Cambió la sesión (login, logout o reintento de lista blanca). */
export function onUser(user) {
  const my = ++authSeq;
  if (!user) {
    stopWatching();
    app.session.close();
    app.lock.release();
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
  'sun-toggle': () => {
    setSunMode(!isSunMode());
    render();
    const btn = document.querySelector('[data-a="sun-toggle"]');
    if (btn) btn.focus();
  },
  'lock-force': () => { if (state.lockInfo) openGame(state.lockInfo.gameId, true); },
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
