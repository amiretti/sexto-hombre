// Geometría de la cancha FIBA en centímetros (28 m × 15 m). Origen arriba a la izquierda.

export const COURT_WIDTH = 2800;
export const COURT_HEIGHT = 1500;
/** Margen tocable alrededor de la cancha (fuera de líneas). */
export const COURT_MARGIN = 60;

const HOOP_X = 157.5, CENTER_Y = 750, THREE_RADIUS = 675, CORNER_Y_TOP = 90, CORNER_Y_BOTTOM = 1410;

/**
 * ¿Un tiro desde (x, y) vale 3?
 * @param {'left'|'right'} [hoop] aro al que se tira; sin dato, el más cercano.
 */
export function isThreePointer(x, y, hoop) {
  const side = hoop || (x < COURT_WIDTH / 2 ? 'left' : 'right');
  const hoopX = side === 'left' ? HOOP_X : COURT_WIDTH - HOOP_X;
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

/* ---------- dirección de ataque ---------- */

export const ATTACK_SIDES = ['left', 'right'];
export const otherSide = (side) => (side === 'left' ? 'right' : 'left');

/**
 * Aro que atacamos en `period`. `game.attackFirstHalf` es el de los dos primeros cuartos;
 * en el 3° se cambia y los suplementarios siguen como el segundo tiempo (FIBA). null si no se cargó.
 */
export function attackingSide(game, period = game.period) {
  const first = game.attackFirstHalf;
  if (!ATTACK_SIDES.includes(first)) return null;
  return period <= 2 ? first : otherSide(first);
}

/** Fija hacia dónde atacamos en el período actual (y deduce el primer tiempo). Muta `game`. */
export function setAttackingSide(game, side) {
  game.attackFirstHalf = game.period <= 2 ? side : otherSide(side);
}

/** Invierte la dirección de ataque (si no estaba cargada, queda atacando a la derecha). Muta `game`. */
export function flipAttackingSide(game) {
  const now = attackingSide(game);
  setAttackingSide(game, now ? otherSide(now) : 'right');
}

/** 'off' (campo rival), 'def' (campo propio) o null si no hay ubicación o dirección. */
export function courtHalf(game, x, period = game.period) {
  const side = attackingSide(game, period);
  if (x == null || !side) return null;
  const inRightHalf = x >= COURT_WIDTH / 2;
  return (side === 'right') === inRightHalf ? 'off' : 'def';
}

/**
 * Zonas para marcar la ubicación sin tocar la cancha (teclado / lector de pantalla).
 * `d` = distancia desde la línea de fondo del aro que atacamos; `y` = posición a lo ancho (0 arriba, 1500 abajo).
 */
export const SHOT_ZONES = [
  { id: 'paint', label: 'Pintura', d: 300, y: 750 },
  { id: 'mid-top', label: 'Media distancia · lado de arriba', d: 450, y: 380 },
  { id: 'mid-center', label: 'Media distancia · frente al aro', d: 700, y: 750 },
  { id: 'mid-bottom', label: 'Media distancia · lado de abajo', d: 450, y: 1120 },
  { id: 'corner-top', label: 'Triple · esquina de arriba', d: 100, y: 50 },
  { id: 'three-center', label: 'Triple · de frente', d: 900, y: 750 },
  { id: 'corner-bottom', label: 'Triple · esquina de abajo', d: 100, y: 1450 },
  { id: 'own-half', label: 'Campo propio', d: 2100, y: 750 }
];

/** Punto de la zona en coordenadas de cancha, según el aro que atacamos (derecha si no se sabe). */
export function zonePoint(zone, attackSide) {
  const x = attackSide === 'left' ? zone.d : COURT_WIDTH - zone.d;
  return { x, y: zone.y };
}

/** Punto en coordenadas de cancha (con margen) → punto dentro de la cancha, o null si quedó afuera. */
export function clampToCourt(x, y) {
  if (x < -COURT_MARGIN || x > COURT_WIDTH + COURT_MARGIN || y < -COURT_MARGIN || y > COURT_HEIGHT + COURT_MARGIN) return null;
  return { x: Math.max(0, Math.min(COURT_WIDTH, x)), y: Math.max(0, Math.min(COURT_HEIGHT, y)) };
}
