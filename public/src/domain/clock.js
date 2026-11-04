// Reloj de juego y períodos. Funciones puras (el "ahora" se puede inyectar para testear).

export const REGULAR_PERIODS = 4;
const OVERTIME_MINUTES = 5;

/** Duración del período en segundos. */
export function periodLengthSec(game, period) {
  return (period <= REGULAR_PERIODS ? +game.periodMin : OVERTIME_MINUTES) * 60;
}

export function periodShort(p) {
  return p <= REGULAR_PERIODS ? p + '°C' : 'S' + (p - REGULAR_PERIODS);
}

export function periodLong(p) {
  return p <= REGULAR_PERIODS ? p + '° cuarto' : 'Suplementario ' + (p - REGULAR_PERIODS);
}

/** Cantidad de suplementarios jugados. */
export function overtimeCount(period) {
  return Math.max(0, period - REGULAR_PERIODS);
}

/** Milisegundos restantes del reloj. */
export function remainingMs(clock, now = Date.now()) {
  return clock.running ? Math.max(0, clock.rem - (now - clock.t0)) : clock.rem;
}

/** Tiempo de reloj en segundos con un decimal (lo que se guarda en cada jugada). */
export function clockStamp(clock, now = Date.now()) {
  return Math.round(remainingMs(clock, now) / 100) / 10;
}

export function newClock(ms) {
  return { rem: ms, running: false, t0: 0 };
}

/** Detiene el reloj congelando el tiempo restante. Muta `clock`. */
export function pauseClock(clock, now = Date.now()) {
  if (clock.running) { clock.rem = remainingMs(clock, now); clock.running = false; }
}

/** Arranca o pausa. Devuelve false si no hay tiempo para arrancar. Muta `clock`. */
export function toggleClock(clock, now = Date.now()) {
  if (clock.running) { pauseClock(clock, now); return true; }
  if (clock.rem <= 0) return false;
  clock.t0 = now; clock.running = true;
  return true;
}

/** Suma/resta segundos respetando [0, máximo del período]. Muta `clock`. */
export function adjustClock(clock, deltaSec, maxSec, now = Date.now()) {
  const r = Math.max(0, Math.min(maxSec * 1000, remainingMs(clock, now) + deltaSec * 1000));
  clock.rem = r;
  if (clock.running) clock.t0 = now;
}

/** Segundos → "7:32" o "45.3" (menos de un minuto). */
export function formatSeconds(t) {
  t = Math.max(0, t);
  if (t < 60) return (Math.floor(t * 10) / 10).toFixed(1);
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + String(s).padStart(2, '0');
}

/** "7:32" | "45.3" | "45,3" → segundos. Inválido → null. */
export function parseClockTime(input) {
  const s = String(input || '').trim().replace(',', '.');
  const m = s.match(/^(\d{1,2}):(\d{1,2}(?:\.\d)?)$/);
  if (m) return (+m[1]) * 60 + (+m[2]);
  if (/^\d{1,3}(\.\d)?$/.test(s)) return +s;
  return null;
}
