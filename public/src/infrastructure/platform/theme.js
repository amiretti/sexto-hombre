// Tema de la interfaz en este dispositivo: claro u oscuro. Mientras no se elija, sigue al sistema.

const KEY = 'pb-theme';

/**
 * Tema que corresponde según lo guardado y el sistema. Valores de versiones anteriores
 * ('sun' = alto contraste claro, 'auto') se leen como claro o como "seguir al sistema".
 * @param {string|null} stored
 * @param {boolean} systemDark
 * @returns {'light'|'dark'}
 */
export function resolveTheme(stored, systemDark) {
  if (stored === 'dark') return 'dark';
  if (stored === 'light' || stored === 'sun') return 'light';
  return systemDark ? 'dark' : 'light';
}

function stored() {
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}

function systemDark() {
  return !!(globalThis.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}

export function currentTheme() {
  return resolveTheme(stored(), systemDark());
}

export function isDarkTheme() {
  return currentTheme() === 'dark';
}

function paint(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#06080b' : '#10141a';
}

/**
 * Aplica el tema al documento (llamar al arrancar). Si no se eligió ninguno, sigue los cambios del sistema.
 * @param {() => void} [onChange] se llama cuando el tema cambia por el sistema
 */
export function applyTheme(onChange) {
  paint(currentTheme());
  if (!globalThis.matchMedia) return;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const s = stored();
    if (s === 'light' || s === 'dark' || s === 'sun') return;
    paint(currentTheme());
    if (onChange) onChange();
  });
}

/** Elige el tema en este dispositivo. */
export function setTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  try { localStorage.setItem(KEY, t); } catch (e) { /* sin almacenamiento: solo esta sesión */ }
  paint(t);
}

export function toggleTheme() {
  setTheme(isDarkTheme() ? 'light' : 'dark');
}
