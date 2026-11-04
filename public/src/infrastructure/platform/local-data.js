// Datos de la app guardados en este dispositivo (localStorage). Todas las claves empiezan con 'pb-'.

const PREFIX = 'pb-';
/** Preferencias del dispositivo (no son datos personales): sobreviven al cerrar sesión. */
const DEVICE_PREFS = new Set(['pb-theme', 'pb-buzzer']);

/** Borra los datos locales de la app (borradores, lista blanca cacheada, modo demo), salvo las preferencias. */
export function clearLocalAppData() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX) && !DEVICE_PREFS.has(k)).forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* sin almacenamiento */ }
}
