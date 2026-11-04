// Edición de un club: nombre, colores (titular y alternativo) y estadios.

import { esc } from '../../shared/html.js';
import { DEFAULT_TEAM_COLOR } from '../../shared/colors.js';
import { MAX_VENUES_PER_CLUB, DEFAULT_ALT_COLOR } from '../../domain/club.js';
import { state, ui } from '../state.js';
import { TOAST_HTML } from '../toast.js';
import { hasTeams } from '../selectors.js';
import { colorField } from '../components/fields.js';

function headerHTML(c) {
  const back = ui.after === 'setup' && hasTeams() ? 'Volver al partido' : 'Mis partidos';
  const note = c.seeded === 'last' ? '<p class="note">Lo armamos con el equipo de tu último partido. Revisalo y guardalo.</p>'
    : c.seeded === 'example' ? '<p class="note">Cargamos un club de ejemplo. <button data-a="club-clear">Vaciar y cargar el mío</button></p>' : '';
  return '<header class="setup-head"><div><p class="eyebrow"><button class="linkback" data-a="club-cancel">‹ ' + back + '</button></p><h1>' +
    (c.isNew ? 'Nuevo club' : (esc(c.name) || 'Club')) + '</h1></div>' + note + '</header>';
}

function infoCardHTML(c) {
  return '<section class="card"><h2>Club</h2><div class="setup-grid">' +
    colorField('f-cname', 'Nombre y color titular', 'name', c.name, 'color', c.color || DEFAULT_TEAM_COLOR, 'titular del club') +
    colorField('f-alt', 'Color alternativo', null, 'Camiseta alternativa', 'altColor', c.altColor || DEFAULT_ALT_COLOR, 'alternativo del club') +
    '</div><p class="lead hint">En cada partido se propone el titular; si se parece al del rival, pasás al alternativo con un toque.</p></section>';
}

function venueRowHTML(v, i, list, defaultId) {
  const n = list.length > 1 ? ' ' + (i + 1) : '';
  const on = v.id === defaultId;
  // Con un solo estadio no hace falta marcarlo: se propone siempre.
  const def = list.length > 1
    ? '<button class="starter" id="vd-' + esc(v.id) + '" data-a="cv-default" data-id="' + esc(v.id) + '" aria-pressed="' + on + '" aria-label="' + esc('Por defecto al jugar de local: ' + (v.name || 'estadio' + n)) + '">' + (on ? '✓ Por defecto' : 'Usar por defecto') + '</button>'
    : '<span></span>';
  return '<div class="vrow"><input id="vn-' + esc(v.id) + '" data-vid="' + esc(v.id) + '" data-vf="name" value="' + esc(v.name) + '" placeholder="Ej.: Estadio principal" aria-label="Nombre del estadio' + n + '" autocomplete="off">' +
    '<input id="vl-' + esc(v.id) + '" data-vid="' + esc(v.id) + '" data-vf="location" value="' + esc(v.location) + '" placeholder="Dirección y ciudad" aria-label="Ubicación del estadio' + n + '" autocomplete="off">' + def +
    '<button class="rm" data-a="cv-rm" data-id="' + esc(v.id) + '" aria-label="' + esc('Quitar estadio ' + (v.name || n.trim() || '')) + '">×</button></div>';
}

function venuesCardHTML(c) {
  const venues = c.venues || [];
  return '<section class="card"><h2>Estadios</h2>' +
    '<p class="lead hint">Dónde juegan de local los planteles del club. Si hay más de una cancha (principal, auxiliar…), marcá la que se propone por defecto; en cada partido de local la podés cambiar.</p>' +
    '<div class="roster">' + (venues.length ? '<div class="vrow headrow" aria-hidden="true"><span>Nombre</span><span>Ubicación</span><span></span><span></span></div>' : '') +
    venues.map((v, i, l) => venueRowHTML(v, i, l, c.defaultVenueId)).join('') + '</div>' +
    '<div class="row"><button class="btn" id="cv-add" data-a="cv-add"' + (venues.length >= MAX_VENUES_PER_CLUB ? ' disabled' : '') + '>+ Agregar estadio</button></div></section>';
}

function footerHTML(c) {
  const armed = ui.confirm === 'cdel';
  return '<div class="setup-foot">' + (c.isNew ? '' : '<button class="btn danger lft' + (armed ? ' armed' : '') + '" data-a="club-del">' + (armed ? '¿Borrar el club?' : 'Borrar club') + '</button>') +
    '<p class="err" id="setup-err" role="alert">' + esc(ui.setupErr) + '</p><button class="btn primary big" data-a="club-save">' + (c.isNew ? 'Guardar y cargar plantel' : 'Guardar club') + '</button></div>';
}

export function clubHTML() {
  const c = state.clubEdit;
  return '<div class="setup">' + headerHTML(c) + infoCardHTML(c) + venuesCardHTML(c) + footerHTML(c) + TOAST_HTML + '</div>';
}
