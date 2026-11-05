// Router de pantallas: dibuja la vista que corresponde a `state.view`.

import { state, currentGame } from './state.js';
import { isBasicSheet } from '../domain/catalog.js';
import { $ } from './dom.js';
import { loginHTML, deniedHTML } from './views/auth-view.js';
import { homeHTML, HOME_TABS, homeTab } from './views/home-view.js';
import { teamHTML } from './views/team-view.js';
import { clubHTML } from './views/club-view.js';
import { competitionHTML } from './views/competition-view.js';
import { reportsHTML } from './views/reports-view.js';
import { setupHTML } from './views/setup-view.js';
import { lockedHTML } from './views/locked-view.js';
import { gameShellHTML, renderGame } from './views/game/game-view.js';

const centered = (text) => '<div class="center"><p class="lead">' + text + '</p></div>';

const SCREENS = {
  boot: () => centered('Cargando…'),
  loading: () => centered('Abriendo el partido…'),
  login: loginHTML,
  denied: deniedHTML,
  home: homeHTML,
  setup: setupHTML,
  team: teamHTML,
  club: clubHTML,
  competition: competitionHTML,
  reports: reportsHTML,
  locked: lockedHTML
};

const TITLES = {
  boot: 'Cargando', loading: 'Abriendo el partido', login: 'Ingresar', denied: 'Cuenta no habilitada',
  home: 'Inicio', setup: 'Nuevo partido', team: 'Plantel', club: 'Club', competition: 'Competición', reports: 'Informes', locked: 'Partido abierto en otro dispositivo'
};

/** Título de la pestaña (lo anuncian los lectores de pantalla al cambiar de pantalla). */
export function setPageTitle(text) {
  document.title = text ? text + ' · Sexto Hombre' : 'Sexto Hombre';
}

export function render() {
  const root = $('#app');
  if (state.view === 'home') setPageTitle(HOME_TABS.find((t) => t.id === homeTab()).title);
  else if (TITLES[state.view]) setPageTitle(TITLES[state.view]);
  const screen = SCREENS[state.view];
  if (screen) { root.innerHTML = screen(); return; }
  root.innerHTML = gameShellHTML(isBasicSheet(currentGame()));
  renderGame();
}
