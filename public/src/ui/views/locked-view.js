// Aviso: el partido está abierto en otro dispositivo.

import { esc } from '../../shared/html.js';
import { lockAgeText } from '../../application/game-lock.js';
import { state } from '../state.js';
import { TOAST_HTML } from '../toast.js';

export function lockedHTML() {
  const L = state.lockInfo || {}, h = L.holder || {};
  return '<div class="brandscreen"><section class="bcard">' +
    '<h1 class="btitle">Partido abierto en otro dispositivo</h1>' +
    '<p class="bcopy"><strong>' + esc(L.team || '') + ' vs ' + esc(L.opponent || '') + '</strong> se está cargando desde ' +
      esc(h.label || 'otro dispositivo') + ' (última actividad ' + esc(lockAgeText(h.at)) + ').</p>' +
    '<p class="bcopy">Para que no se mezclen los datos, un partido se carga desde un solo dispositivo a la vez. ' +
      'Si abrís acá, el otro deja de poder guardar cambios.</p>' +
    '<div class="row"><button class="btn big bghost" data-a="go-home">Volver</button>' +
    '<button class="btn big bprimary" data-a="lock-force">Abrir acá igual</button></div></section></div>' + TOAST_HTML;
}
