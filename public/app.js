// Punto de entrada (composition root): crea las dependencias, registra los controladores y arranca.
//
// Capas (src/):
//   shared/          utilidades sin dependencias (ids, html, colores)
//   domain/          reglas del básquet y del partido, puras y testeables
//   application/     casos de uso (sesión del partido, reporte, CSV); dependen del puerto `store`
//   infrastructure/  adaptadores: Firebase / demo (store), PDF, dispositivo
//   ui/              vistas (HTML) y controladores (acciones data-a)

import { createStore } from './src/infrastructure/store/index.js';
import { createGameSession } from './src/application/game-session.js';
import { registerServiceWorker } from './src/infrastructure/platform/device.js';
import { esc } from './src/shared/html.js';
import { app, state, currentGame } from './src/ui/state.js';
import { $ } from './src/ui/dom.js';
import { render } from './src/ui/render.js';
import { reportSaveError } from './src/ui/toast.js';
import { registerActions, startEventLoop } from './src/ui/events.js';
import { navigationActions, onUser } from './src/ui/navigation.js';
import { homeActions } from './src/ui/controllers/home-controller.js';
import { teamActions } from './src/ui/controllers/team-controller.js';
import { setupActions } from './src/ui/controllers/setup-controller.js';
import { registerFormHandlers } from './src/ui/controllers/form-controller.js';
import { gameActions, registerGameHandlers, startClockTicker } from './src/ui/controllers/game-controller.js';
import { renderSync } from './src/ui/views/game/game-view.js';

// El orden importa: los manejadores de formularios atienden Escape antes que el partido.
registerActions(navigationActions);
registerActions(homeActions);
registerActions(teamActions);
registerActions(setupActions);
registerActions(gameActions);
registerFormHandlers();
registerGameHandlers();
startEventLoop();
startClockTicker();

const persistGame = () => { if (currentGame()) app.session.persistNow(); };
window.addEventListener('online', renderSync);
window.addEventListener('offline', renderSync);
window.addEventListener('pagehide', persistGame);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistGame(); });

render();
createStore().then((store) => {
  app.store = store;
  app.session = createGameSession({ store, onSaveError: reportSaveError });
  store.onPending((n) => { state.pending = n; renderSync(); });
  store.onAuth(onUser);
}).catch((e) => {
  console.error(e);
  $('#app').innerHTML = '<div class="center"><section class="card auth"><h1>No se pudo iniciar</h1><p class="lead">' + esc(e.message || e) +
    '</p><p class="lead">Revisá la conexión y volvé a abrir la app.</p></section></div>';
});
registerServiceWorker();
