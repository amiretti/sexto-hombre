// Interruptor de tema claro / oscuro (sol a un lado, luna al otro).

import { isDarkTheme } from '../../infrastructure/platform/theme.js';

const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/></svg>';

/** Botón role=switch: marcado = tema oscuro. */
export function themeSwitchHTML() {
  const dark = isDarkTheme();
  return '<button type="button" class="theme-switch" role="switch" data-a="theme-toggle" aria-checked="' + dark + '" aria-label="Tema oscuro" title="' + (dark ? 'Pasar a modo claro' : 'Pasar a modo oscuro') + '">' +
    '<span class="ts-icon ts-sun">' + SUN + '</span><span class="ts-track"><span class="ts-knob"></span></span><span class="ts-icon ts-moon">' + MOON + '</span></button>';
}
