// Estado de la interfaz. Un solo lugar, mutado por los controladores y leído por las vistas.
// El partido en curso NO vive acá: lo lleva la sesión (app.session.game).

/** Dependencias de la app, se completan en el arranque (app.js). */
export const app = {
  /** Puerto de datos (infrastructure/store). */
  store: null,
  /** Sesión del partido en curso (application/game-session). */
  session: null
};

/** Estado de la app (qué pantalla, quién, qué datos). */
export const state = {
  view: 'boot', // boot | login | denied | home | setup | team | loading | game
  user: null,
  profile: null,
  games: null,  // null = cargando
  gamesErr: '',
  teams: null,  // null = cargando
  teamEdit: null,
  setup: null,
  pending: 0
};

/** Estado efímero de la pantalla actual. Se reinicia al cambiar de pantalla. */
export const ui = {};

export function resetUi() {
  for (const k of Object.keys(ui)) delete ui[k];
  Object.assign(ui, {
    authErr: '',
    // partido
    step: 'loc',      // loc | player | action | foul | tov | ft | staff
    pending: null,    // momento capturado (domain/game captureMoment)
    player: null,     // jugador elegido
    overlay: null,    // history | box | subs | clock | menu | final | forced
    forced: null,     // {out, why, evId}
    draft: null,      // borrador de edición de jugada
    confirm: null,    // id de la acción destructiva "armada"
    subSel: null,     // jugadores marcados en el cambio
    ft: { att: 2, res: [null, null] },
    csv: null,        // CSV a mostrar si no se pudo copiar
    // formularios
    setupErr: '',
    colorOpen: null,
    after: 'home'     // a dónde volver al cerrar el plantel
  });
}
resetUi();

/** Partido en curso o null. */
export function currentGame() {
  return app.session ? app.session.game : null;
}

export function isDemo() {
  return !!app.store && app.store.mode === 'demo';
}

/** Formulario activo (plantel o previa), para los inputs con data-f. */
export function activeForm() {
  if (state.view === 'team') return state.teamEdit;
  if (state.view === 'setup') return state.setup;
  return null;
}
