// Avisos breves. En el partido van bajo el tablero; en celular, con la hoja de carga abierta, justo encima de ella
// (sobre el tablero) para no tapar las acciones. Reciben texto plano: se escapa acá.

import { esc } from '../shared/html.js';
import { $ } from './dom.js';

/** Contenedor del aviso; cada pantalla lo incluye en su HTML. */
export const TOAST_HTML = '<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>';

const SHORT_MS = 2500, LONG_MS = 5000, UNDO_MS = 6000;
let timer = null;

/** Ubica el aviso (ya visible, para poder medir su alto). */
function place(el) {
  const board = document.querySelector('.board');
  el.style.left = ''; el.style.top = ''; el.style.bottom = '';
  if (!board) return;
  el.style.bottom = 'auto';
  let top = board.getBoundingClientRect().bottom + 8;
  // Celular con la hoja de carga (pasos 2 y 3) abierta: encima de la hoja, sobre el tablero.
  const sheet = document.querySelector('.panel[data-step]:not([data-step="loc"])');
  if (sheet && getComputedStyle(sheet).position === 'fixed' && innerWidth <= 760) {
    top = Math.min(top, sheet.getBoundingClientRect().top - el.offsetHeight - 6);
  }
  el.style.top = Math.round(Math.max(8, top)) + 'px';
  // Tablet: centrado sobre la cancha, el panel (asistencia, pasos) queda libre.
  const col = document.querySelector('.court-col');
  if (col && innerWidth > 760) { const r = col.getBoundingClientRect(); el.style.left = Math.round(r.left + r.width / 2) + 'px'; }
}

/**
 * @param {string} text texto plano
 * @param {boolean} [warn] aviso destacado (dura más)
 * @param {string} [undoEventId] muestra «Deshacer» para esa jugada
 */
/**
 * @param {{label: string, a: string, o?: string}} [action] botón extra (por ejemplo «Hacer cambios»)
 */
export function toast(text, warn = false, undoEventId = null, action = null) {
  const el = $('#toast');
  if (!el) return;
  el.className = 'toast' + (warn ? ' warn' : '');
  el.setAttribute('aria-live', warn ? 'assertive' : 'polite');
  el.innerHTML = '<span>' + esc(text) + '</span>' +
    (action ? '<button data-a="' + esc(action.a) + '"' + (action.o ? ' data-o="' + esc(action.o) + '"' : '') + (action.id ? ' data-id="' + esc(action.id) + '"' : '') + '>' + esc(action.label) + '</button>' : '') +
    (undoEventId ? '<button data-a="undo-id" data-id="' + esc(undoEventId) + '">Deshacer</button>' : '') +
    '<button class="toast-x" type="button" aria-label="Cerrar aviso">×</button>';
  el.hidden = false;
  place(el);
  const ms = undoEventId || action ? UNDO_MS : warn ? LONG_MS : SHORT_MS;
  const hide = () => { el.hidden = true; };
  clearTimeout(timer);
  timer = setTimeout(hide, ms);
  // Mientras el dedo, el mouse o el foco están sobre el aviso, no se oculta.
  if (!el.dataset.hold) {
    el.dataset.hold = '1';
    el.addEventListener('click', (e) => { if (e.target.closest('.toast-x')) { clearTimeout(timer); el.hidden = true; } });
    const keep = () => clearTimeout(timer);
    const release = () => { clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, 3000); };
    el.addEventListener('pointerenter', keep); el.addEventListener('focusin', keep);
    el.addEventListener('pointerleave', release); el.addEventListener('focusout', release);
  }
}

/** Reubica el aviso visible (por ejemplo, al abrirse o cerrarse la hoja de carga en celular). */
export function repositionToast() {
  const el = $('#toast');
  if (el && !el.hidden) place(el);
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
