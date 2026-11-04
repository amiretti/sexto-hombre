// Router de pantallas: dibuja la vista que corresponde a `state.view`.

import { state } from './state.js';
import { $ } from './dom.js';
import { loginHTML, deniedHTML } from './views/auth-view.js';
import { homeHTML } from './views/home-view.js';
import { teamHTML } from './views/team-view.js';
import { setupHTML } from './views/setup-view.js';
import { gameShellHTML, renderGame } from './views/game/game-view.js';

const centered = (text) => '<div class="center"><p class="lead">' + text + '</p></div>';

const SCREENS = {
  boot: () => centered('Cargando…'),
  loading: () => centered('Abriendo el partido…'),
  login: loginHTML,
  denied: deniedHTML,
  home: homeHTML,
  setup: setupHTML,
  team: teamHTML
};

export function render() {
  const root = $('#app');
  const screen = SCREENS[state.view];
  if (screen) { root.innerHTML = screen(); return; }
  root.innerHTML = gameShellHTML();
  renderGame();
}
