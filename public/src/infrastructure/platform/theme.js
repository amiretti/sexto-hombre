// Tema de la interfaz en este dispositivo: automático (claro/oscuro según el sistema) o «modo sol»,
// de alto contraste para usar al aire libre o con mucha luz.

const KEY = 'pb-theme';
const SUN = 'sun';

export function isSunMode() {
  try { return localStorage.getItem(KEY) === SUN; } catch (e) { return false; }
}

/** Aplica el tema guardado al documento (llamar al arrancar). */
export function applyTheme() {
  const root = document.documentElement;
  if (isSunMode()) root.dataset.theme = SUN;
  else if (root.dataset.theme === SUN) delete root.dataset.theme;
}

export function setSunMode(on) {
  try { localStorage.setItem(KEY, on ? SUN : 'auto'); } catch (e) { /* sin almacenamiento: solo esta sesión */ }
  if (on) document.documentElement.dataset.theme = SUN;
  else delete document.documentElement.dataset.theme;
}
