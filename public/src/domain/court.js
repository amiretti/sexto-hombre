// Geometría de la cancha FIBA en centímetros (28 m × 15 m). Origen arriba a la izquierda.

export const COURT_WIDTH = 2800;
export const COURT_HEIGHT = 1500;
/** Margen tocable alrededor de la cancha (fuera de líneas). */
export const COURT_MARGIN = 60;

const HOOP_X = 157.5, CENTER_Y = 750, THREE_RADIUS = 675, CORNER_Y_TOP = 90, CORNER_Y_BOTTOM = 1410;

export function isThreePointer(x, y) {
  const hoopX = x < COURT_WIDTH / 2 ? HOOP_X : COURT_WIDTH - HOOP_X;
  return Math.hypot(x - hoopX, y - CENTER_Y) > THREE_RADIUS || y < CORNER_Y_TOP || y > CORNER_Y_BOTTOM;
}

/** Nombre de la zona de tiro, '' si no hay ubicación. */
export function zoneName(x, y) {
  if (x == null) return '';
  const lx = x < COURT_WIDTH / 2 ? x : COURT_WIDTH - x;
  if (isThreePointer(x, y)) return (y < CORNER_Y_TOP || y > CORNER_Y_BOTTOM) ? 'triple esquina' : 'zona de triple';
  if (lx <= 580 && Math.abs(y - CENTER_Y) <= 245) return 'pintura';
  if (lx > COURT_WIDTH / 2 - 200) return 'medio campo';
  return 'media distancia';
}

/** Punto en coordenadas de cancha (con margen) → punto dentro de la cancha, o null si quedó afuera. */
export function clampToCourt(x, y) {
  if (x < -COURT_MARGIN || x > COURT_WIDTH + COURT_MARGIN || y < -COURT_MARGIN || y > COURT_HEIGHT + COURT_MARGIN) return null;
  return { x: Math.max(0, Math.min(COURT_WIDTH, x)), y: Math.max(0, Math.min(COURT_HEIGHT, y)) };
}
