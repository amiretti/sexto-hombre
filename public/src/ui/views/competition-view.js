// Edición de una competición: nombre, temporada y duración del cuarto.

import { esc } from '../../shared/html.js';
import { state, ui } from '../state.js';
import { TOAST_HTML } from '../toast.js';
import { textField, periodLengthField } from '../components/fields.js';

function headerHTML(c) {
  const back = ui.after === 'setup' ? 'Volver al partido' : 'Competiciones';
  return '<header class="setup-head"><div><p class="eyebrow"><button class="linkback" data-a="comp-cancel">‹ ' + back + '</button></p><h1>' +
    (c.isNew ? 'Nueva competición' : (esc(c.name) || 'Competición')) + '</h1></div></header>';
}

function infoCardHTML(c) {
  return '<section class="card"><h2>Competición</h2><div class="setup-grid">' +
    textField('f-cpname', 'Nombre', 'name', c.name) +
    '<div class="field"><label for="f-season">Temporada</label><input id="f-season" data-f="season" inputmode="numeric" maxlength="7" value="' + esc(c.season || '') + '" placeholder="2026"></div>' +
    periodLengthField(c.periodMin) +
    '</div><p class="lead hint">Se elige al crear cada partido y propone la duración del cuarto. Los partidos ya jugados conservan el nombre con el que se jugaron.</p></section>';
}

function footerHTML(c) {
  const armed = ui.confirm === 'cpdel';
  return '<div class="setup-foot">' + (c.isNew ? '' : '<button class="btn danger lft' + (armed ? ' armed' : '') + '" data-a="comp-del">' + (armed ? '¿Borrar la competición?' : 'Borrar competición') + '</button>') +
    '<p class="err" id="setup-err" role="alert">' + esc(ui.setupErr) + '</p><button class="btn primary big" data-a="comp-save">Guardar competición</button></div>';
}

export function competitionHTML() {
  const c = state.competitionEdit;
  return '<div class="setup">' + headerHTML(c) + infoCardHTML(c) + footerHTML(c) + TOAST_HTML + '</div>';
}
