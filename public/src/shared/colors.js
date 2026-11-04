// Paleta de colores de equipos y utilidades de color.

export const DEFAULT_TEAM_COLOR = '#1d4fc4';
export const DEFAULT_OPPONENT_COLOR = '#c3372c';

export const SWATCH_NAMES = {
  '#1d4fc4': 'Azul', '#0e2a5c': 'Azul marino', '#5aa9e6': 'Celeste', '#c3372c': 'Rojo', '#7a1f2b': 'Bordó',
  '#16834a': 'Verde', '#f2c230': 'Amarillo', '#f07d1a': 'Naranja', '#6b3fa0': 'Violeta', '#111111': 'Negro',
  '#ffffff': 'Blanco', '#8a8f98': 'Gris'
};
export const SWATCHES = Object.keys(SWATCH_NAMES);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Color válido '#rrggbb' o `fallback`. Usar siempre antes de insertar un color en HTML/CSS:
 * los colores vienen del store y esc() no impide inyectar propiedades CSS con ';'.
 */
export function safeColor(hex, fallback) {
  return HEX_COLOR.test(String(hex || '')) ? hex : fallback;
}

/** '#rrggbb' → [r, g, b]. Valores inválidos devuelven `fallback`. */
export function hexToRgb(hex, fallback = [0, 0, 0]) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return fallback;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** true si dos colores son difíciles de distinguir en la cancha. */
export function colorsTooClose(a, b) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90;
}

/** Luminancia percibida alta (necesita borde para verse sobre blanco). */
export function isLightRgb(c) {
  return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 200;
}
