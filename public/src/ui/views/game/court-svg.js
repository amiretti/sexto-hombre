// Cancha en SVG (coordenadas en cm) y marcas de tiros.

import { $ } from '../../dom.js';
import { ui, currentGame } from '../../state.js';
import { attackingSide } from '../../../domain/court.js';

/** Coordenada numérica segura para insertar en el SVG (los datos vienen del store). */
const n = (v) => Number(v) || 0;

const HALF = '<rect class="c-key" x="0" y="505" width="580" height="490"/>' +
  '<g class="c-lines"><rect x="0" y="505" width="580" height="490"/><circle cx="580" cy="750" r="180"/>' +
  '<path d="M0 90 L299 90 A675 675 0 0 1 299 1410 L0 1410"/><path d="M157.5 625 A125 125 0 0 1 157.5 875"/></g>' +
  '<line class="c-board" x1="120" y1="660" x2="120" y2="840"/><circle class="c-hoop" cx="157.5" cy="750" r="22.5"/>';

export const COURT_SVG = '<svg id="court" viewBox="-60 -60 2920 1620" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Cancha. Tocá donde ocurrió la jugada.">' +
  '<rect class="c-out" x="-60" y="-60" width="2920" height="1620"/><rect class="c-floor" x="0" y="0" width="2800" height="1500"/>' +
  '<g>' + HALF + '</g><g transform="matrix(-1 0 0 1 2800 0)">' + HALF + '</g>' +
  '<g class="c-lines"><rect x="0" y="0" width="2800" height="1500"/><line x1="1400" y1="0" x2="1400" y2="1500"/><circle cx="1400" cy="750" r="180"/></g>' +
  '<g id="dots"></g><g id="pend"></g></svg>';

function madeDot(e) {
  return '<circle class="dot-m" cx="' + n(e.x) + '" cy="' + n(e.y) + '" r="30"/>';
}

function missDot(e) {
  return '<g class="dot-x"><line x1="' + (n(e.x) - 24) + '" y1="' + (n(e.y) - 24) + '" x2="' + (n(e.x) + 24) + '" y2="' + (n(e.y) + 24) + '"/>' +
    '<line x1="' + (n(e.x) - 24) + '" y1="' + (n(e.y) + 24) + '" x2="' + (n(e.x) + 24) + '" y2="' + (n(e.y) - 24) + '"/></g>';
}

function shotMarks(game) {
  let h = '';
  game.events.forEach((e) => {
    if (e.x == null) return;
    if (e.type === '2M' || e.type === '3M') h += madeDot(e);
    else if (e.type === '2X' || e.type === '3X') h += missDot(e);
  });
  const last = game.events.filter((e) => e.x != null).slice(-1)[0];
  if (last) h += '<circle class="dot-last" cx="' + n(last.x) + '" cy="' + n(last.y) + '" r="58"/>';
  return h;
}

function pendingMark(p) {
  if (!(p && p.x != null)) return '';
  return '<circle class="pend-ring" cx="' + n(p.x) + '" cy="' + n(p.y) + '" r="70"/><circle class="pend-core" cx="' + n(p.x) + '" cy="' + n(p.y) + '" r="22"/>';
}

export function renderDots() {
  const el = $('#dots');
  if (!el) return;
  el.innerHTML = shotMarks(currentGame());
  $('#pend').innerHTML = pendingMark(ui.pending);
  const atk = $('#attack-ind'), side = attackingSide(currentGame());
  if (atk) atk.textContent = side === 'right' ? 'Atacamos →' : side === 'left' ? '← Atacamos' : '¿Hacia dónde atacamos? Tocá';
  const tip = $('#court-tip');
  if (tip) tip.hidden = ui.step !== 'loc' || !!ui.overlay;
}
