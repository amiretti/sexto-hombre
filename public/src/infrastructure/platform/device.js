// Capacidades del dispositivo: pantalla encendida, portapapeles, service worker, conexión.

let wakeLock = null;

/** Pide mantener la pantalla encendida (si el navegador lo permite y la página está visible). */
export function keepScreenOn() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      navigator.wakeLock.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
    }
  } catch (e) { /* no soportado */ }
}

/** Copia texto al portapapeles. Rechaza si no se pudo. */
export function copyToClipboard(text) {
  try { return navigator.clipboard.writeText(text); } catch (e) { return Promise.reject(e); }
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

export function isOnline() {
  return navigator.onLine;
}
