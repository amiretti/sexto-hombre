// Catálogo de tipos de jugada. Fuente única de verdad para códigos y textos.

export const EVENT_LABELS = {
  '2M': 'Doble convertido', '2X': 'Doble errado', '3M': 'Triple convertido', '3X': 'Triple errado', 'FT': 'Tiros libres',
  'RO': 'Rebote ofensivo', 'RD': 'Rebote defensivo', 'AST': 'Asistencia', 'STL': 'Robo', 'BLK': 'Tapón', 'TOV': 'Pérdida',
  'PF': 'Falta personal', 'FD': 'Falta recibida', 'TF': 'Falta técnica', 'UF': 'Falta antideportiva', 'DF': 'Falta descalificante',
  'SUB': 'Cambio', 'TO': 'Tiempo muerto', 'REV': 'Pedido de revisión', 'TTOV': 'Pérdida de equipo'
};

export const TURNOVER_KINDS = {
  pase: 'Mal pase', manejo: 'Pérdida de balón', pasos: 'Pasos / caminata', doble: 'Doble dribling', fuera: 'Pelota afuera',
  '3s': '3 segundos', '5s': '5 segundos', '8s': '8 segundos', '24s': '24 segundos', atras: 'Campo atrás', otra: 'Otra', gen: 'Sin detalle'
};

/**
 * Pérdidas del equipo, sin jugador ni ubicación (FIBA): se agota la posesión de 24 s o no se pasa la mitad en 8 s.
 * Las de jugador ya cargadas con 8 s o 24 s se siguen leyendo, pero ya no se ofrecen.
 */
export const TEAM_TURNOVER_KINDS = { '24s': '24 segundos', '8s': '8 segundos' };

export const PERSONAL_FOUL_KINDS = {
  none: 'Sin tiro', shot2: 'En tiro de 2 · 2 libres', shot3: 'En tiro de 3 · 3 libres',
  and1: 'Encestó igual · gol + 1 libre', off: 'Falta ofensiva', gen: 'Sin detalle'
};

export const FOUL_DRAWN_KINDS = {
  none: 'Sin tiro', bonus: 'Sin tiro · rival en penalización · 2 libres', shot2: 'En tiro de 2 · 2 libres', shot3: 'En tiro de 3 · 3 libres', and1: 'Encestó igual · gol + 1 libre'
};

/**
 * Tipo de planilla, elegido al crear el partido. Los partidos viejos (sin `sheet`) son avanzados.
 * La básica carga las mismas jugadas, sin cancha (sin ubicación) y sin el detalle de faltas y pérdidas.
 */
export const SHEET_KINDS = {
  full: { label: 'Avanzada', detail: 'Cancha con la ubicación de cada jugada, mapa de tiros y el detalle de faltas y pérdidas.' },
  basic: { label: 'Básica', detail: 'Solo botones, sin cancha ni mapa de tiros: tiros, rebotes, tapones, robos, pérdidas, faltas y cambios.' }
};

export function isBasicSheet(game) {
  return !!game && game.sheet === 'basic';
}

/**
 * Botonera de la planilla básica: código del botón → jugada que registra (después de elegir al jugador).
 * FD no está: la falta recibida pregunta antes cuántos libres hubo.
 */
export const BASIC_ACTIONS = {
  '1M': { label: 'Simple convertido', action: { type: 'FT', att: 1, made: 1 } },
  '1X': { label: 'Simple errado', action: { type: 'FT', att: 1, made: 0 } },
  '2M': { label: 'Doble convertido', action: { type: '2M' } },
  '2X': { label: 'Doble errado', action: { type: '2X' } },
  '3M': { label: 'Triple convertido', action: { type: '3M' } },
  '3X': { label: 'Triple errado', action: { type: '3X' } },
  'RO': { label: 'Rebote ofensivo', action: { type: 'RO' } },
  'RD': { label: 'Rebote defensivo', action: { type: 'RD' } },
  'BLK': { label: 'Tapón', action: { type: 'BLK' } },
  'STL': { label: 'Robo', action: { type: 'STL' } },
  'TOV': { label: 'Pérdida', action: { type: 'TOV', sub: 'gen' } },
  'PF': { label: 'Falta cometida', action: { type: 'PF', sub: 'gen' } },
  'FD': { label: 'Falta recibida', action: null }
};

/** Subtipos por tipo de jugada y el valor por defecto de cada uno. */
const SUBTYPES = {
  TOV: { kinds: TURNOVER_KINDS, fallback: 'otra' },
  PF: { kinds: PERSONAL_FOUL_KINDS, fallback: 'none' },
  FD: { kinds: FOUL_DRAWN_KINDS, fallback: 'none' },
  TTOV: { kinds: TEAM_TURNOVER_KINDS, fallback: '24s' }
};

/** true si el tipo de jugada lleva detalle (subtipo). */
export function hasSubtype(type) {
  return !!SUBTYPES[type];
}

/** {código: texto} de los subtipos de `type`, o null. */
export function subtypeKinds(type) {
  return SUBTYPES[type] ? SUBTYPES[type].kinds : null;
}

/** Texto del subtipo, '' si no tiene. */
export function subtypeLabel(type, sub) {
  const kinds = subtypeKinds(type);
  return (kinds && kinds[sub]) || '';
}

/** Libres que corresponden a una falta en situación de tiro ('none' = 0). */
export const FREE_THROWS_FOR = { none: 0, bonus: 2, shot2: 2, shot3: 3, and1: 1 };

/** Tipos que se pueden elegir al editar una jugada de un jugador. */
export const EDITABLE_EVENT_TYPES = ['2M', '2X', '3M', '3X', 'FT', 'RO', 'RD', 'AST', 'STL', 'BLK', 'TOV', 'PF', 'FD', 'TF', 'UF', 'DF'];

/** Acciones del partido que no son de un jugador (sin ubicación ni jugador). */
const TEAM_EVENT_TYPES = new Set(['SUB', 'TO', 'REV', 'TTOV']);
export function isTeamEvent(type) {
  return TEAM_EVENT_TYPES.has(type);
}

/**
 * Acciones que ocurren con la pelota viva (el reloj corre): tiros de campo, rebotes, asistencias,
 * robos, tapones y las pérdidas que suelen terminar en robo. Faltas, libres, violaciones,
 * tiempos muertos y cambios ocurren con el reloj detenido.
 */
const LIVE_BALL_TYPES = new Set(['2M', '2X', '3M', '3X', 'RO', 'RD', 'AST', 'STL', 'BLK']);
const LIVE_BALL_TURNOVERS = new Set(['pase', 'manejo']);
export function isLiveBallAction(type, sub) {
  return LIVE_BALL_TYPES.has(type) || (type === 'TOV' && LIVE_BALL_TURNOVERS.has(sub));
}

/** Acciones que detienen el reloj al cargarse. */
export const STOPPAGE_TYPES = ['TO', 'REV'];

/** Tipos que se pueden cargar al cuerpo técnico. */
export const STAFF_EVENT_TYPES = ['TF', 'DF'];

const FOUL_TYPES = new Set(['PF', 'TF', 'UF', 'DF']);

/** Faltas que cuentan para el jugador y para el equipo. */
export function isFoul(type) {
  return FOUL_TYPES.has(type);
}

/** Destinatarios de faltas que no son jugadores. */
export const COACH = 'coach';
export const BENCH = 'bench';
export function isStaff(who) {
  return who === COACH || who === BENCH;
}

/** Normaliza el subtipo según el tipo (usado al editar). */
export function normalizeSubtype(type, sub) {
  const s = SUBTYPES[type];
  if (s && !s.kinds[sub]) return s.fallback;
  return sub;
}
