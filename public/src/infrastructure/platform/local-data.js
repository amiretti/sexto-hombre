// Datos de la app guardados en este dispositivo (localStorage). Todas las claves empiezan con 'pb-'.

const PREFIX = 'pb-';

/** Borra todos los datos locales de la app (borradores, lista blanca cacheada, modo demo). */
export function clearLocalAppData() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* sin almacenamiento */ }
}
