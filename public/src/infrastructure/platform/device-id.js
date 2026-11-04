// Identidad de este dispositivo para el bloqueo de partidos. Es por pestaña (sessionStorage):
// dos pestañas o dos dispositivos cuentan como distintos; recargar la página conserva el id.

const KEY = 'pb-device';

function platformLabel() {
  const ua = navigator.userAgent || '';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'celular Android' : 'tablet Android';
  if (/Windows/.test(ua)) return 'computadora Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'otro dispositivo';
}

/** @returns {{id: string, label: string}} */
export function currentDevice() {
  let id = null;
  try { id = sessionStorage.getItem(KEY); } catch (e) { /* sin almacenamiento */ }
  if (!id) {
    id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try { sessionStorage.setItem(KEY, id); } catch (e) { /* sin almacenamiento */ }
  }
  return { id, label: platformLabel() };
}
