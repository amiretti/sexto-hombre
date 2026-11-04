// Despachador de eventos del DOM. Los controladores registran acciones (data-a) y manejadores;
// este módulo es el único que escucha `document`.
//
// Contrato de una acción:  (ctx) => void
//   ctx.el     el elemento [data-a] tocado
//   ctx.id     ctx.el.dataset.id
//   ctx.data   ctx.el.dataset
//   ctx.event  el evento original

const actions = Object.create(null);
const clickInterceptors = [];
const inputHandlers = [];
const changeHandlers = [];
const keyHandlers = [];

/** Registra acciones por nombre de data-a. Los nombres son únicos en toda la app. */
export function registerActions(map) {
  for (const name of Object.keys(map)) {
    if (actions[name]) throw new Error('Acción duplicada: ' + name);
    actions[name] = map[name];
  }
}

/** Se ejecuta antes de buscar [data-a]. Si devuelve true, el clic se da por atendido. */
export function onClickBefore(fn) { clickInterceptors.push(fn); }
export function onInput(fn) { inputHandlers.push(fn); }
export function onChange(fn) { changeHandlers.push(fn); }
/** Si devuelve true, los manejadores siguientes no se ejecutan. */
export function onKeydown(fn) { keyHandlers.push(fn); }

export function startEventLoop() {
  document.addEventListener('click', (event) => {
    for (const fn of clickInterceptors) if (fn(event)) return;
    const el = event.target.closest && event.target.closest('[data-a]');
    if (!el) return;
    const handler = actions[el.dataset.a];
    if (handler) handler({ el, id: el.dataset.id, data: el.dataset, event });
  });
  document.addEventListener('input', (event) => inputHandlers.forEach((fn) => fn(event)));
  document.addEventListener('change', (event) => changeHandlers.forEach((fn) => fn(event)));
  document.addEventListener('keydown', (event) => {
    for (const fn of keyHandlers) if (fn(event)) return;
  });
}
