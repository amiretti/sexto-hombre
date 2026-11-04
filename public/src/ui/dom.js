// Helpers mínimos de DOM.

export const $ = (selector) => document.querySelector(selector);

/** Enfoca el elemento y deja el cursor al final del texto. */
export function focusId(id) {
  const el = document.getElementById(id);
  if (!el || !el.focus) return;
  el.focus();
  if (el.value != null) {
    const n = el.value.length;
    try { el.setSelectionRange(n, n); } catch (e) { /* inputs sin selección (color, date) */ }
  }
}

/** Enfoca el botón de color del campo `field` (al cerrar el selector). */
export function focusColorChip(field) {
  const chip = document.querySelector('.cchip[data-f="' + field + '"]');
  if (chip) chip.focus();
}
