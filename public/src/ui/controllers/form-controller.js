// Manejo genérico de los formularios (plantel y previa): campos data-f / data-pf y selector de color.

import { ui, activeForm } from '../state.js';
import { render } from '../render.js';
import { focusColorChip } from '../dom.js';
import { setColorPopover } from '../components/fields.js';
import { registerActions, onClickBefore, onInput, onChange, onKeydown } from '../events.js';
import { persistView } from '../navigation.js';

const fieldHooks = {};

/**
 * Registra qué hacer cuando cambia un campo data-f (después de guardarlo en el formulario).
 * Un mismo campo puede tener varios (uno por pantalla): cada uno revisa `state.view`.
 */
export function onFieldChange(field, fn) {
  (fieldHooks[field] = fieldHooks[field] || []).push(fn);
}

/** Un clic fuera del selector de color lo cierra (y el clic sigue su curso). */
function closeColorOnOutsideClick(event) {
  if (activeForm() && ui.colorOpen && !(event.target.closest && event.target.closest('.cpick'))) setColorPopover(null);
  return false;
}

function paintColorChip(field, color) {
  const chip = document.querySelector('.cchip[data-f="' + field + '"]');
  if (chip) chip.style.background = color;
}

function handleInput(event) {
  const t = event.target, form = activeForm();
  if (!form) return;
  if (t.dataset.f) {
    form[t.dataset.f] = t.value;
    persistView();
    if (t.type === 'color') paintColorChip(t.dataset.f, t.value);
  }
  if (t.dataset.pf && form.players) {
    const p = form.players.find((x) => x.id === t.dataset.pid);
    if (p) { p[t.dataset.pf] = t.value; persistView(); }
  }
  if (t.dataset.vf && form.venues) {
    const v = form.venues.find((x) => x.id === t.dataset.vid);
    if (v) { v[t.dataset.vf] = t.value; persistView(); }
  }
}

function handleChange(event) {
  const t = event.target, form = activeForm();
  if (!form || !t.dataset.f) return;
  form[t.dataset.f] = t.value;
  persistView();
  if (t.type === 'color') render();
  (fieldHooks[t.dataset.f] || []).forEach((fn) => fn(form));
}

const ARROWS = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/** Grupos segmentados (role=radiogroup): las flechas cambian la opción y el foco la sigue. */
function moveRadio(event) {
  const step = ARROWS[event.key];
  const radio = event.target.closest && event.target.closest('[role="radio"]');
  const group = radio && radio.closest('[role="radiogroup"]');
  if (!step || !group) return false;
  const radios = [...group.querySelectorAll('[role="radio"]')];
  const next = radios[(radios.indexOf(radio) + step + radios.length) % radios.length];
  event.preventDefault();
  const action = next.dataset.a;
  next.click(); // re-dibuja la previa
  const checked = document.querySelector('[role="radio"][data-a="' + action + '"][aria-checked="true"]');
  if (checked) checked.focus();
  return true;
}

function handleKeydown(event) {
  if (activeForm() && moveRadio(event)) return true;
  if (!(activeForm() && event.key === 'Escape' && ui.colorOpen)) return false;
  const field = ui.colorOpen;
  setColorPopover(null);
  focusColorChip(field);
  return true;
}

const colorActions = {
  'color-open': ({ data }) => setColorPopover(ui.colorOpen === data.f ? null : data.f),
  'swatch': ({ data }) => {
    const form = activeForm();
    if (!form) return;
    form[data.f] = data.c;
    ui.colorOpen = null;
    persistView();
    render();
    focusColorChip(data.f);
  }
};

export function registerFormHandlers() {
  onClickBefore(closeColorOnOutsideClick);
  registerActions(colorActions);
  onInput(handleInput);
  onChange(handleChange);
  onKeydown(handleKeydown);
}

