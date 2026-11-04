// Avisos breves al pie de la pantalla. Reciben texto plano: se escapa acá.

import { esc } from '../shared/html.js';
import { $ } from './dom.js';

/** Contenedor del aviso; cada pantalla lo incluye en su HTML. */
export const TOAST_HTML = '<div id="toast" class="toast" hidden></div>';

const SHORT_MS = 3500, LONG_MS = 6000;
let timer = null;

/**
 * @param {string} text texto plano
 * @param {boolean} [warn] aviso destacado (dura más)
 * @param {string} [undoEventId] muestra «Deshacer» para esa jugada
 */
export function toast(text, warn = false, undoEventId = null) {
  const el = $('#toast');
  if (!el) return;
  el.className = 'toast' + (warn ? ' warn' : '');
  el.innerHTML = '<span>' + esc(text) + '</span>' + (undoEventId ? '<button data-a="undo-id" data-id="' + esc(undoEventId) + '">Deshacer</button>' : '');
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, warn ? LONG_MS : SHORT_MS);
}

export function hideToast() {
  const el = $('#toast');
  if (el) el.hidden = true;
}

/** Aviso estándar cuando falla una escritura en el store. */
export function reportSaveError(e) {
  console.error(e);
  toast('No se pudo guardar en la nube (' + ((e && e.code) || (e && e.message) || 'error') + '). Revisá tu acceso.', true);
}
