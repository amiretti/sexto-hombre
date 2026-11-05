// Filas que se deslizan a la izquierda para mostrar una acción (como en iOS): se usa para borrar partidos.
// Marcado: <li data-swipe><div class="gslide">…</div><button class="swipe-act">…</button></li>.
// Con teclado o lector de pantalla, al llegar con el foco al botón la fila se abre sola.

const OPEN_PX = 96;      // cuánto se corre la fila abierta (ancho del botón)
const THRESHOLD = 40;    // deslizamiento mínimo para que quede abierta
const SLOP = 10;         // movimiento antes de decidir si es deslizar o hacer scroll

let drag = null;
let openRow = null;
let swallowClick = false;

const slideOf = (row) => row.querySelector('.gslide');

function setOpen(row, open) {
  if (!row || !row.isConnected) { if (openRow === row) openRow = null; return; }
  const slide = slideOf(row);
  if (slide) slide.style.transform = '';
  row.classList.toggle('open', open);
  if (open) {
    if (openRow && openRow !== row) setOpen(openRow, false);
    openRow = row;
  } else if (openRow === row) openRow = null;
}

function onDown(e) {
  const row = e.target.closest && e.target.closest('[data-swipe]');
  if (openRow && openRow !== row) setOpen(openRow, false);
  if (!row || e.button > 0 || e.target.closest('.swipe-act')) return;
  drag = { row, id: e.pointerId, x: e.clientX, y: e.clientY, base: row.classList.contains('open') ? -OPEN_PX : 0, dx: 0, active: false };
}

function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.active) {
    if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // es scroll
    if (Math.abs(dx) < SLOP) return;
    drag.active = true;
    drag.row.classList.add('dragging');
  }
  drag.dx = dx;
  const x = Math.max(-OPEN_PX * 1.25, Math.min(0, drag.base + dx));
  slideOf(drag.row).style.transform = 'translateX(' + x + 'px)';
}

function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.active) return;
  d.row.classList.remove('dragging');
  setOpen(d.row, d.base + d.dx < -THRESHOLD);
  // El toque que terminó un deslizamiento no abre el partido.
  swallowClick = true;
  setTimeout(() => { swallowClick = false; }, 350);
}

export function registerSwipeRows() {
  document.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', () => {
    if (drag && drag.active) { drag.row.classList.remove('dragging'); setOpen(drag.row, drag.base < 0); }
    drag = null;
  });
  window.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation(); e.preventDefault();
  }, true);
  document.addEventListener('focusin', (e) => {
    const act = e.target.closest && e.target.closest('.swipe-act');
    if (act) setOpen(act.closest('[data-swipe]'), true);
    else if (openRow && !openRow.contains(e.target)) setOpen(openRow, false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openRow) setOpen(openRow, false); });
}
