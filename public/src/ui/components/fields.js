// Campos de formulario reutilizables (plantel y previa del partido).
// Los inputs con data-f escriben en el formulario activo (ver form-controller).

import { esc } from '../../shared/html.js';
import { SWATCHES, SWATCH_NAMES, DEFAULT_TEAM_COLOR, safeColor } from '../../shared/colors.js';
import { state, ui } from '../state.js';

import { PERIOD_LENGTHS } from '../../domain/competition.js';

/** Campo de texto simple. */
export function textField(id, label, field, value) {
  return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" data-f="' + field + '" value="' + esc(value) + '"></div>';
}

function swatchButton(colorField, color, current) {
  return '<button type="button" data-a="swatch" data-f="' + colorField + '" data-c="' + color + '" style="background:' + color + '" title="' + SWATCH_NAMES[color] +
    '" aria-label="' + SWATCH_NAMES[color] + '" aria-pressed="' + (color === current) + '"></button>';
}

/**
 * Nombre + selector de color.
 * @param {string} id          id del input de nombre
 * @param {string} label
 * @param {string|null} field  campo del nombre; null = nombre fijo (solo se elige el color)
 * @param {string} value       nombre
 * @param {string} colorKey    campo del color
 * @param {string} color       color actual
 * @param {string} who         "del equipo", "del rival"… (para lectores de pantalla)
 * @param {string} [extra]     HTML extra junto a la etiqueta (solo con nombre fijo)
 */
export function colorField(id, label, field, value, colorKey, color, who, extra) {
  const open = ui.colorOpen === colorKey, cur = String(color).toLowerCase();
  return '<div class="field' + (field ? '' : ' wide') + '">' + (field ? '<label for="' + id + '">' + label + '</label>' : '<span class="flabel">' + label + (extra || '') + '</span>') + '<div class="tc cpick">' +
    '<button type="button" class="cchip" data-a="color-open" data-f="' + colorKey + '" style="background:' + esc(safeColor(color, DEFAULT_TEAM_COLOR)) + '" aria-haspopup="true" aria-expanded="' + open +
    '" aria-controls="' + id + '-pop" aria-label="Color ' + who + ': ' + esc(SWATCH_NAMES[cur] || color) + '"></button>' +
    (field ? '<input id="' + id + '" data-f="' + field + '" value="' + esc(value) + '" autocomplete="off">' : '<span class="tstatic" id="' + id + '" title="' + esc(value) + '">' + esc(value) + '</span>') +
    '<div class="cpop" id="' + id + '-pop" role="dialog" aria-label="Color ' + who + '"' + (open ? '' : ' hidden') + '>' +
    '<div class="sw" role="group" aria-label="Colores">' + SWATCHES.map((c) => swatchButton(colorKey, c, cur)).join('') + '</div>' +
    '<label class="custom"><input type="color" data-f="' + colorKey + '" value="' + esc(safeColor(color, DEFAULT_TEAM_COLOR)) + '">Otro color…</label>' +
    '</div></div></div>';
}

/** Duración del cuarto. */
export function periodLengthField(value) {
  const options = PERIOD_LENGTHS.map((x) => '<option value="' + x + '"' + (String(value || '10') === x ? ' selected' : '') + '>' + x + ' minutos</option>').join('');
  return '<div class="field"><label for="f-len">Duración del cuarto</label><select id="f-len" data-f="periodMin">' + options + '</select></div>';
}

/** Abre el selector de color `colorField` (null cierra todos) sin volver a dibujar la pantalla. */
export function setColorPopover(colorField) {
  ui.colorOpen = colorField;
  document.querySelectorAll('.cpick').forEach((w) => {
    const chip = w.querySelector('.cchip'), open = chip.dataset.f === colorField;
    chip.setAttribute('aria-expanded', open);
    w.querySelector('.cpop').hidden = !open;
  });
}
