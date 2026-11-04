// Generadores de identificadores y fechas. Sin dependencias del DOM.

/** Id corto para filas locales (jugadores de un plantel). */
export function shortId() {
  return Math.random().toString(36).slice(2, 9);
}

/** Id globalmente único para documentos (partidos, planteles, jugadas). */
export function newId() {
  try {
    if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* sin crypto: usamos el fallback */ }
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

/** YYYY-MM-DD → DD/MM/YYYY (si no matchea, devuelve el valor tal cual). */
export function formatDate(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Copia profunda de datos planos (JSON-safe). */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
