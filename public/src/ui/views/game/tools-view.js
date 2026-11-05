// Barra de herramientas bajo la cancha e indicador de sincronización.

import { $ } from '../../dom.js';
import { state, currentGame, isDemo } from '../../state.js';
import { isOnline } from '../../../infrastructure/platform/device.js';
import { isBasicSheet } from '../../../domain/catalog.js';

const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

export function renderTools() {
  $('#tools').innerHTML = '<button class="btn" data-a="ov" data-o="history">Historial <span class="num">(' + currentGame().events.length + ')</span></button>' +
    '<button class="btn" data-a="ov" data-o="box">Planilla</button><button class="btn" data-a="ov" data-o="subs">Cambios</button>' +
    '<button class="btn share" data-a="share">Compartir PDF</button>' +
    '<span class="sp"></span>' + (isBasicSheet(currentGame()) ? '' : '<span class="legend"><span><i></i>Convertido</span><span><b>✕</b>Errado</span></span>') + '<span id="sync" class="sync"></span><button class="btn menu-btn" data-a="ov" data-o="menu" aria-haspopup="dialog">' + GEAR + 'Partido</button>';
  renderSync();
}

export function renderSync() {
  const el = $('#sync');
  if (!el) return;
  if (isDemo()) { el.className = 'sync demo'; el.textContent = 'Modo demo'; return; }
  const n = state.pending, off = !isOnline();
  el.className = 'sync' + (n ? ' wait' : '');
  el.textContent = n ? (n + ' sin enviar' + (off ? ' · sin señal' : '')) : (off ? 'Sin señal · guardado local' : 'Guardado');
}
