// Pantalla del partido: estructura y redibujo completo.

import { pauseClock } from '../../../domain/clock.js';
import { pendingForcedExit } from '../../../domain/game.js';
import { ui, currentGame } from '../../state.js';
import { persistView } from '../../navigation.js';
import { TOAST_HTML } from '../../toast.js';
import { COURT_SVG, renderDots } from './court-svg.js';
import { renderBoard, tickClockDisplay } from './board-view.js';
import { renderPanel } from './panel-view.js';
import { renderOverlay } from './overlays-view.js';
import { renderTools, renderSync } from './tools-view.js';

export { renderBoard, tickClockDisplay, renderPanel, renderOverlay, renderDots, renderTools, renderSync };

export function gameShellHTML() {
  return '<div class="game"><header class="board" id="board"></header><main class="stage">' +
    '<section class="court-col"><p class="rotate">Girá la tablet o el celular para ver la cancha más grande.</p><div class="court-wrap">' + COURT_SVG + '<div class="court-tip" id="court-tip">Tocá dónde ocurrió la jugada</div></div><div class="tools" id="tools"></div></section>' +
    '<aside class="panel" id="panel" aria-live="polite"></aside></main><div id="overlay"></div>' + TOAST_HTML + '</div>';
}

/** Si un jugador en cancha quedó excluido (p. ej. al editar el historial), abre el cambio obligatorio. */
function openForcedExitIfNeeded() {
  if (ui.overlay) return;
  const G = currentGame();
  const forced = pendingForcedExit(G);
  if (!forced) return;
  if (G.clock.running) { pauseClock(G.clock); persistView(); }
  ui.forced = forced;
  ui.overlay = 'forced';
}

export function renderGame() {
  openForcedExitIfNeeded();
  renderBoard();
  renderTools();
  renderPanel();
  renderOverlay();
}
