// Mapa de tiros: tiros de campo llevados a una misma media cancha y agrupados por zona.
//
// Marco normalizado: el aro que se ataca queda en x = 0 (línea de fondo); `x` es la distancia
// desde el fondo (0 a 1400 cm, más allá es campo propio) e `y` va a lo ancho (0 a 1500).
// Mirando al aro, y > 750 queda a la izquierda del tirador.

import { COURT_WIDTH, COURT_HEIGHT, attackingSide, isThreePointer } from './court.js';

export const HALF_LENGTH = COURT_WIDTH / 2;
export const HOOP = { x: 157.5, y: 750 };
/** Debajo de esto la zona tiene "pocos tiros" para sacar conclusiones de acierto. */
export const MIN_ATTEMPTS_FOR_PCT = 3;

const RIM_RADIUS = 200, KEY_LENGTH = 580, KEY_HALF_WIDTH = 245, CORNER_X = 299;
const SHOT_TYPES = { '2M': [2, true], '2X': [2, false], '3M': [3, true], '3X': [3, false] };

/**
 * Zonas en el orden en que se listan (de cerca a lejos; de izquierda a derecha mirando al aro).
 * `value` = puntos que vale un tiro desde ahí (para la eficiencia).
 */
export const CHART_ZONES = [
  { id: 'rim', label: 'Bajo el aro', value: 2 },
  { id: 'paint', label: 'Pintura', value: 2 },
  { id: 'mid-lb', label: 'Media · fondo izquierda', value: 2 },
  { id: 'mid-lw', label: 'Media · lateral izquierda', value: 2 },
  { id: 'mid-c', label: 'Media · de frente', value: 2 },
  { id: 'mid-rw', label: 'Media · lateral derecha', value: 2 },
  { id: 'mid-rb', label: 'Media · fondo derecha', value: 2 },
  { id: 'c3-l', label: 'Triple · esquina izquierda', value: 3 },
  { id: 'w3-l', label: 'Triple · lateral izquierda', value: 3 },
  { id: 't3-c', label: 'Triple · de frente', value: 3 },
  { id: 'w3-r', label: 'Triple · lateral derecha', value: 3 },
  { id: 'c3-r', label: 'Triple · esquina derecha', value: 3 },
  { id: 'back', label: 'Desde campo propio', value: 3 }
];

/** Tiro de campo: {value, made} o null si la jugada no es un tiro de campo. */
export function shotInfo(e) {
  const t = SHOT_TYPES[e && e.type];
  return t ? { value: t[0], made: t[1] } : null;
}

/**
 * Ubicación del tiro en el marco normalizado, o null si no se marcó.
 * Con la dirección de ataque cargada se gira la cancha (no se espeja: izquierda sigue siendo izquierda);
 * sin ella se toma el aro más cercano.
 */
export function normalizeShot(game, e) {
  if (e.x == null || e.y == null) return null;
  const side = attackingSide(game, e.period) || (e.x < HALF_LENGTH ? 'left' : 'right');
  return side === 'left' ? { x: e.x, y: e.y } : { x: COURT_WIDTH - e.x, y: COURT_HEIGHT - e.y };
}

/** Ángulo en grados desde el aro: 0 = de frente, positivo hacia la izquierda del tirador. */
function angleFromHoop(x, y) {
  return Math.atan2(y - HOOP.y, x - HOOP.x) * 180 / Math.PI;
}

/** Zona de un punto normalizado. */
export function zoneAt(x, y) {
  if (x > HALF_LENGTH) return 'back';
  const a = angleFromHoop(x, y), left = a > 0, abs = Math.abs(a);
  if (isThreePointer(x, y, 'left')) {
    if (x <= CORNER_X) return left ? 'c3-l' : 'c3-r';
    if (abs < 22) return 't3-c';
    return left ? 'w3-l' : 'w3-r';
  }
  if (Math.hypot(x - HOOP.x, y - HOOP.y) <= RIM_RADIUS) return 'rim';
  if (x <= KEY_LENGTH && Math.abs(y - HOOP.y) <= KEY_HALF_WIDTH) return 'paint';
  if (abs >= 60) return left ? 'mid-lb' : 'mid-rb';
  if (abs >= 25) return left ? 'mid-lw' : 'mid-rw';
  return 'mid-c';
}

/**
 * Mapa de tiros de varios partidos.
 * @param {object[]} games partidos con `events`
 * @param {{playerId?: string|null}} [opts] sin jugador = todo el equipo
 * @returns {{zones: object[], shots: object[], total: {att:number, made:number}, unlocated: number}}
 *   zones: [{id, label, value, att, made, pct (0-1|null), share (0-1), pps (puntos por tiro|null)}]
 */
export function buildShotChart(games, { playerId = null } = {}) {
  const acc = Object.fromEntries(CHART_ZONES.map((z) => [z.id, { att: 0, made: 0 }]));
  const shots = [];
  let att = 0, made = 0, unlocated = 0;
  for (const game of games) {
    for (const e of game.events || []) {
      const info = shotInfo(e);
      if (!info || (playerId && e.who !== playerId)) continue;
      att++; if (info.made) made++;
      const p = normalizeShot(game, e);
      if (!p) { unlocated++; continue; }
      const zone = zoneAt(p.x, p.y);
      acc[zone].att++; if (info.made) acc[zone].made++;
      shots.push({ x: p.x, y: p.y, made: info.made, zone });
    }
  }
  const located = att - unlocated;
  const zones = CHART_ZONES.map((z) => {
    const a = acc[z.id];
    return {
      ...z, att: a.att, made: a.made,
      pct: a.att ? a.made / a.att : null,
      share: located ? a.att / located : 0,
      pps: a.att ? a.made * z.value / a.att : null
    };
  });
  return { zones, shots, total: { att, made }, unlocated };
}

/* ---------- geometría para dibujar las zonas (en el marco normalizado) ---------- */

function ray(angleDeg, r = 3200) {
  const rad = angleDeg * Math.PI / 180;
  return [HOOP.x + r * Math.cos(rad), HOOP.y + r * Math.sin(rad)];
}

/** Cuña desde el aro entre dos ángulos (se recorta después a la media cancha). */
function wedge(from, to) {
  const pts = [[HOOP.x, HOOP.y]];
  for (let a = from; a < to; a += 15) pts.push(ray(a));
  pts.push(ray(to));
  return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
}

/** Línea de triple: zona de dos puntos (esquinas rectas + arco). */
export const INSIDE_ARC_PATH = 'M0 90L' + CORNER_X + ' 90A675 675 0 0 1 ' + CORNER_X + ' 1410L0 1410Z';

/**
 * Formas de las zonas para un SVG en el marco normalizado. `clip`: 'inside' (dentro del arco),
 * 'outside' (fuera del arco) o null. Se dibujan en este orden (las de arriba tapan a las de abajo).
 */
export const ZONE_SHAPES = [
  { id: 'w3-l', clip: 'outside', d: wedge(22, 180) },
  { id: 'w3-r', clip: 'outside', d: wedge(-180, -22) },
  { id: 't3-c', clip: 'outside', d: wedge(-22, 22) },
  { id: 'c3-l', clip: null, d: 'M0 1410H' + CORNER_X + 'V1500H0Z' },
  { id: 'c3-r', clip: null, d: 'M0 0H' + CORNER_X + 'V90H0Z' },
  { id: 'mid-lb', clip: 'inside', d: wedge(60, 180) },
  { id: 'mid-rb', clip: 'inside', d: wedge(-180, -60) },
  { id: 'mid-lw', clip: 'inside', d: wedge(25, 60) },
  { id: 'mid-rw', clip: 'inside', d: wedge(-60, -25) },
  { id: 'mid-c', clip: 'inside', d: wedge(-25, 25) },
  { id: 'paint', clip: null, d: 'M0 ' + (HOOP.y - KEY_HALF_WIDTH) + 'H' + KEY_LENGTH + 'V' + (HOOP.y + KEY_HALF_WIDTH) + 'H0Z' },
  { id: 'rim', clip: null, d: 'M' + (HOOP.x - RIM_RADIUS) + ' ' + HOOP.y + 'a' + RIM_RADIUS + ' ' + RIM_RADIUS + ' 0 1 0 ' + (2 * RIM_RADIUS) + ' 0a' + RIM_RADIUS + ' ' + RIM_RADIUS + ' 0 1 0 ' + (-2 * RIM_RADIUS) + ' 0Z' }
];

/** Dónde va el rótulo de cada zona (marco normalizado). */
export const ZONE_LABEL_AT = {
  'rim': [300, 750], 'paint': [470, 750],
  'mid-lb': [300, 1180], 'mid-lw': [520, 1060], 'mid-c': [700, 750], 'mid-rw': [520, 440], 'mid-rb': [300, 320],
  'c3-l': [200, 1455], 'w3-l': [760, 1300], 't3-c': [1050, 750], 'w3-r': [760, 200], 'c3-r': [200, 45]
};
