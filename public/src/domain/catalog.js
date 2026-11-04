// Catálogo de tipos de jugada. Fuente única de verdad para códigos y textos.

export const EVENT_LABELS = {
  '2M': 'Doble convertido', '2X': 'Doble errado', '3M': 'Triple convertido', '3X': 'Triple errado', 'FT': 'Tiros libres',
  'RO': 'Rebote ofensivo', 'RD': 'Rebote defensivo', 'AST': 'Asistencia', 'STL': 'Robo', 'BLK': 'Tapón', 'TOV': 'Pérdida',
  'PF': 'Falta personal', 'FD': 'Falta recibida', 'TF': 'Falta técnica', 'UF': 'Falta antideportiva', 'DF': 'Falta descalificante',
  'SUB': 'Cambio'
};

export const TURNOVER_KINDS = {
  pase: 'Mal pase', manejo: 'Pérdida de balón', pasos: 'Pasos / caminata', doble: 'Doble dribling', fuera: 'Pelota afuera',
  '3s': '3 segundos', '5s': '5 segundos', '8s': '8 segundos', '24s': '24 segundos', atras: 'Campo atrás', otra: 'Otra'
};

export const PERSONAL_FOUL_KINDS = {
  none: 'Sin tiro', shot2: 'En tiro de 2 · 2 libres', shot3: 'En tiro de 3 · 3 libres',
  and1: 'Encestó igual · gol + 1 libre', off: 'Falta ofensiva'
};

/** Tipos que se pueden elegir al editar una jugada de un jugador. */
export const EDITABLE_EVENT_TYPES = ['2M', '2X', '3M', '3X', 'FT', 'RO', 'RD', 'AST', 'STL', 'BLK', 'TOV', 'PF', 'FD', 'TF', 'UF', 'DF'];

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
  if (type === 'TOV' && !TURNOVER_KINDS[sub]) return 'otra';
  if (type === 'PF' && !PERSONAL_FOUL_KINDS[sub]) return 'none';
  return sub;
}
