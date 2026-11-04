// Barra de herramientas bajo la cancha e indicador de sincronización.

import { $ } from '../../dom.js';
import { state, currentGame, isDemo } from '../../state.js';
import { isOnline } from '../../../infrastructure/platform/device.js';

export function renderTools() {
  $('#tools').innerHTML = '<button class="btn" data-a="ov" data-o="history">Historial <span class="num">(' + currentGame().events.length + ')</span></button>' +
    '<button class="btn" data-a="ov" data-o="box">Planilla</button><button class="btn" data-a="ov" data-o="subs">Cambios</button>' +
    '<button class="btn share" data-a="share">Compartir PDF</button>' +
    '<span class="sp"></span><span class="legend"><span><i></i>Convertido</span><span><b>✕</b>Errado</span></span><span id="sync" class="sync"></span><button class="btn ghost" data-a="ov" data-o="menu">Partido ▾</button>';
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
