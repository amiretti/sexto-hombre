// Avisos breves (arriba en tablet, abajo en celular). Reciben texto plano: se escapa acá.

import { esc } from '../shared/html.js';
import { $ } from './dom.js';

/** Contenedor del aviso; cada pantalla lo incluye en su HTML. */
export const TOAST_HTML = '<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>';

const SHORT_MS = 4000, LONG_MS = 7000, UNDO_MS = 10000;
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
  el.setAttribute('aria-live', warn ? 'assertive' : 'polite');
  el.innerHTML = '<span>' + esc(text) + '</span>' + (undoEventId ? '<button data-a="undo-id" data-id="' + esc(undoEventId) + '">Deshacer</button>' : '');
  // En el partido va justo debajo del tablero (no tapa reloj ni barra de herramientas).
  const board = document.querySelector('.board');
  el.style.top = board && innerWidth > 760 ? Math.round(board.getBoundingClientRect().bottom + 8) + 'px' : '';
  el.hidden = false;
  const ms = undoEventId ? UNDO_MS : warn ? LONG_MS : SHORT_MS;
  const hide = () => { el.hidden = true; };
  clearTimeout(timer);
  timer = setTimeout(hide, ms);
  // Mientras el dedo, el mouse o el foco están sobre el aviso, no se oculta.
  if (!el.dataset.hold) {
    el.dataset.hold = '1';
    const keep = () => clearTimeout(timer);
    const release = () => { clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, 3000); };
    el.addEventListener('pointerenter', keep); el.addEventListener('focusin', keep);
    el.addEventListener('pointerleave', release); el.addEventListener('focusout', release);
  }
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
