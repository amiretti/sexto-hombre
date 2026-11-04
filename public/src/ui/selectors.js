// Lecturas derivadas del estado de la UI.

import { state } from './state.js';

/** Plantel por id dentro de los planteles cargados, o null. */
export function teamById(id) {
  return (state.teams || []).find((t) => t.id === id) || null;
}

/** Hay al menos un plantel cargado. */
export function hasTeams() {
  return (state.teams || []).length > 0;
}
