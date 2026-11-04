// Manejo del foco cuando la interfaz se redibuja (las vistas reemplazan innerHTML).
// Sin esto, cada re-render deja el foco en <body> y el teclado / lector de pantalla se pierde.

const KEY_ATTRS = ['id', 'o', 't', 's', 'd', 'team', 'n', 'm', 'i', 'v', 'w', 'f', 'c', 'z'];

/** Selector que vuelve a encontrar "el mismo" control después de redibujar. */
export function focusKey(el) {
  if (!el || el === document.body || !el.matches) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  if (el.tagName === 'SUMMARY') return 'summary';
  const ds = el.dataset || {};
  if (!ds.a) return null;
  let sel = '[data-a="' + CSS.escape(ds.a) + '"]';
  for (const k of KEY_ATTRS) if (ds[k] != null) sel += '[data-' + k + '="' + CSS.escape(ds[k]) + '"]';
  return sel;
}

/** Primer control enfocable dentro de `root`. */
export function firstFocusable(root) {
  return root && root.querySelector('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, summary, [tabindex]:not([tabindex="-1"])');
}

export function focusQuiet(el) {
  if (el && el.focus) el.focus({ preventScroll: true });
}

/**
 * Redibuja `container` con `render()` sin perder el foco: si estaba adentro, vuelve al mismo control
 * o, si ya no existe (cambió el paso), al que devuelva `fallback()`.
 */
export function rerenderKeepingFocus(container, render, fallback) {
  const active = document.activeElement;
  const had = container && active && container.contains(active);
  const key = had ? focusKey(active) : null;
  render();
  if (!had) return;
  const target = (key && container.querySelector(key)) || (fallback ? fallback() : firstFocusable(container));
  focusQuiet(target);
}
