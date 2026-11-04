// Controlador de la pantalla del partido: traduce toques y teclas en casos de uso y redibuja.

import { EVENT_LABELS } from '../../domain/catalog.js';
import { periodLengthSec, periodLong, toggleClock, adjustClock } from '../../domain/clock.js';
import { clampToCourt } from '../../domain/court.js';
import { ourScore, opponentScore, requiredOnCourt } from '../../domain/stats.js';
import { whoLabel } from '../../domain/describe.js';
import {
  captureMoment, lastLoggedEvent, adjustOpponentScore, applySubstitution, applyForcedSubstitution, substitutionEvent,
  advancePeriod, setClockManually, finishGame, tickClock, newEditDraft, normalizeEditDraft, applyEditDraft
} from '../../domain/game.js';
import { buildGameReport } from '../../application/game-report.js';
import { historyCsv, boxScoreCsv } from '../../application/csv-export.js';
import { buildPdf } from '../../infrastructure/pdf/pdf-renderer.js';
import { sharePdf } from '../../infrastructure/pdf/share.js';
import { copyToClipboard, keepScreenOn } from '../../infrastructure/platform/device.js';
import { app, state, ui, currentGame, isDemo } from '../state.js';
import { $ } from '../dom.js';
import { toast, hideToast } from '../toast.js';
import { onClickBefore, onChange, onKeydown } from '../events.js';
import { persistView } from '../navigation.js';
import { renderGame, renderBoard, renderPanel, renderOverlay, renderDots, tickClockDisplay } from '../views/game/game-view.js';

const TICK_MS = 100;
const session = () => app.session;

/* ---------- pasos de carga ---------- */

function resetPlayFlow() {
  ui.step = 'loc';
  ui.pending = null;
  ui.player = null;
}

function goToStep(step) {
  ui.step = step;
  renderPanel();
}

function startPlayAt(x, y, step) {
  ui.pending = captureMoment(currentGame(), x, y);
  ui.step = step;
  renderPanel();
  renderDots();
}

function record(action) {
  const result = session().recordPlay(ui.pending, { ...action, who: action.who || ui.player });
  if (result.error) { toast(result.error, true); return; }
  resetPlayFlow();
  if (result.forced) {
    ui.forced = result.forced;
    ui.overlay = 'forced';
    ui.draft = null; ui.confirm = null; ui.csv = null;
    renderGame();
    hideToast();
    return;
  }
  renderGame();
  toast(result.message, result.warn, result.event.id);
}

/* ---------- reloj ---------- */

function toggleGameClock() {
  if (!toggleClock(currentGame().clock)) return;
  persistView();
  renderBoard();
}

function periodEndMessage(G) {
  if (G.period < 4) return 'Fin del ' + periodLong(G.period);
  const us = ourScore(G), them = opponentScore(G);
  if (us === them) return 'Empate ' + them + ' a ' + them + ': va a suplementario';
  return 'Final del partido: ' + G.team + ' ' + us + ' – ' + them + ' ' + G.opponent;
}

function onTick() {
  const G = currentGame();
  if (state.view !== 'game' || !G || !G.clock.running) return;
  const what = tickClock(G);
  if (what === 'running') { tickClockDisplay(); return; }
  if (what === 'final') {
    if (!ui.overlay) ui.overlay = 'final';
    session().persistNow();
    renderGame();
    return;
  }
  persistView();
  renderBoard();
  toast(periodEndMessage(G), true);
}

export function startClockTicker() {
  setInterval(onTick, TICK_MS);
}

/* ---------- overlays ---------- */

function closeOverlay() {
  ui.overlay = null; ui.confirm = null; ui.draft = null; ui.csv = null;
  renderGame();
}

function copyCsv(text) {
  ui.csv = null;
  const fallback = () => { ui.csv = text; renderOverlay(); };
  copyToClipboard(text).then(() => toast('Copiado. Pegalo en una planilla de cálculo.'), fallback);
}

function sharePlanilla(closeAfter) {
  const G = currentGame();
  let pdf;
  try {
    pdf = buildPdf(buildGameReport(G, { generatedBy: isDemo() ? '' : state.user.name }));
  } catch (e) {
    console.error(e);
    toast('No se pudo generar el PDF: ' + (e.message || e), true);
    return;
  }
  sharePdf(pdf).then((r) => {
    if (closeAfter) { ui.overlay = null; renderGame(); }
    if (r === 'downloaded') toast('Se descargó ' + pdf.filename + '. Este navegador no permite compartir archivos.');
    else if (r === 'shared') toast('Planilla compartida');
  });
}

/* ---------- cambios ---------- */

function forcedSubstitution(inId) {
  const G = currentGame(), F = ui.forced;
  if (!F) return;
  const change = applyForcedSubstitution(G, F.out, inId);
  session().addEvent(substitutionEvent(G, change));
  ui.forced = null; ui.overlay = null;
  persistView();
  renderGame();
  toast(inId
    ? 'Cambio registrado: entra ' + whoLabel(G, inId) + ' por ' + whoLabel(G, F.out) + '. Tocá el reloj para seguir.'
    : 'Sale ' + whoLabel(G, F.out) + '. Tocá el reloj para seguir.');
}

function saveSubstitution() {
  const G = currentGame();
  if (ui.subSel.length !== requiredOnCourt(G)) return;
  const change = applySubstitution(G, ui.subSel);
  if (change.inn.length || change.out.length) session().addEvent(substitutionEvent(G, change));
  ui.overlay = null;
  persistView();
  renderGame();
  if (change.inn.length) toast('Cambio registrado: entra ' + change.inn.map((x) => whoLabel(G, x)).join(', '));
}

/* ---------- edición de jugadas ---------- */

/** Lee el formulario de edición al borrador. */
function readDraft() {
  const d = ui.draft;
  if (!d) return;
  const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
  if (v('e-who') != null) d.who = v('e-who');
  if (v('e-type') != null) d.type = v('e-type');
  if (v('e-sub') != null) d.sub = v('e-sub');
  if (v('e-att') != null) d.att = +v('e-att');
  if (v('e-made') != null) d.made = +v('e-made');
  if (v('e-per') != null) d.period = +v('e-per');
  if (v('e-time') != null) d.timeStr = v('e-time');
  normalizeEditDraft(d);
}

function saveEdit() {
  readDraft();
  const G = currentGame(), d = ui.draft;
  const event = G.events.find((x) => x.id === d.id);
  const err = applyEditDraft(G, event, d);
  if (err) { d.err = err; renderOverlay(); return; }
  session().updateEvent(event);
  ui.draft = null;
  renderGame();
  toast('Jugada corregida');
}

function deleteWithConfirm(id) {
  if (ui.confirm === 'del-' + id) {
    session().deleteEvent(id);
    ui.confirm = null; ui.draft = null;
    renderGame();
  } else {
    ui.confirm = 'del-' + id;
    renderOverlay();
  }
}

function undoLast() {
  const G = currentGame(), last = lastLoggedEvent(G);
  if (!last) return;
  session().deleteEvent(last.id);
  renderGame();
  toast('Se deshizo: ' + whoLabel(G, last.who) + ' · ' + EVENT_LABELS[last.type]);
}

/* ---------- acciones ---------- */

const handlers = {
  'clock': () => toggleGameClock(),
  'adj': ({ data }) => {
    const G = currentGame();
    adjustClock(G.clock, +data.d, periodLengthSec(G, G.period));
    persistView(); renderBoard();
  },
  'next-period': () => {
    const G = currentGame();
    if (!advancePeriod(G)) return;
    persistView(); renderGame();
    toast('Arranca el ' + periodLong(G.period) + '. Tocá el reloj para iniciar.');
  },
  'clock-edit': () => { ui.overlay = 'clock'; ui.csv = null; renderOverlay(); },
  'clock-save': () => {
    const per = +$('#c-per').value, m = parseInt($('#c-m').value, 10) || 0, s = parseInt($('#c-s').value, 10) || 0;
    setClockManually(currentGame(), per, m, s);
    ui.overlay = null; persistView(); renderGame();
  },
  'opp': ({ data }) => { adjustOpponentScore(currentGame(), +data.d); persistView(); renderBoard(); },
  'noloc': () => startPlayAt(null, null, 'player'),
  'staff': () => startPlayAt(null, null, 'staff'),
  'cancel': () => { resetPlayFlow(); renderPanel(); renderDots(); },
  'pick': ({ id }) => { ui.player = id; goToStep('action'); },
  'back': () => { ui.player = null; goToStep('player'); },
  'back-action': () => goToStep('action'),
  'act': ({ data }) => record({ type: data.t, sub: data.s }),
  'act-staff': ({ data }) => record({ type: data.t, who: data.w }),
  'foul': () => goToStep('foul'),
  'tov': () => goToStep('tov'),
  'ft': () => { ui.ft = { att: 2, res: [null, null] }; goToStep('ft'); },
  'ft-att': ({ data }) => {
    const n = +data.n;
    ui.ft.att = n;
    ui.ft.res = ui.ft.res.slice(0, n);
    while (ui.ft.res.length < n) ui.ft.res.push(null);
    renderPanel();
  },
  'ft-res': ({ data }) => { ui.ft.res[+data.i] = data.v; renderPanel(); },
  'ft-save': () => {
    const f = ui.ft;
    if (f.res.includes(null)) return;
    record({ type: 'FT', att: f.att, made: f.res.filter((r) => r === 'm').length });
  },
  'undo': () => undoLast(),
  'undo-id': ({ id }) => { session().deleteEvent(id); hideToast(); renderGame(); },
  'ov': ({ data }) => {
    ui.overlay = data.o; ui.confirm = null; ui.draft = null; ui.csv = null;
    if (ui.overlay === 'subs') ui.subSel = currentGame().onCourt.slice();
    renderOverlay();
  },
  'close-ov': () => closeOverlay(),
  'forced-pick': ({ id }) => forcedSubstitution(id),
  'forced-none': () => forcedSubstitution(null),
  'forced-undo': () => {
    const F = ui.forced;
    if (!F) return;
    if (F.evId) session().deleteEvent(F.evId);
    ui.forced = null; ui.overlay = null;
    persistView(); renderGame();
    toast('Falta deshecha. El reloj sigue detenido.');
  },
  'sub-tog': ({ id }) => {
    const i = ui.subSel.indexOf(id);
    if (i >= 0) ui.subSel.splice(i, 1); else ui.subSel.push(id);
    renderOverlay();
  },
  'sub-save': () => saveSubstitution(),
  'edit': ({ id }) => {
    const e = currentGame().events.find((x) => String(x.id) === id);
    ui.draft = newEditDraft(e); ui.confirm = null;
    renderOverlay();
  },
  'cancel-edit': () => { ui.draft = null; renderOverlay(); },
  'save-edit': () => saveEdit(),
  'del': ({ id }) => deleteWithConfirm(id),
  'share': ({ data }) => sharePlanilla(data.close === '1'),
  'finish': () => {
    if (ui.confirm !== 'finish') { ui.confirm = 'finish'; renderOverlay(); return; }
    finishGame(currentGame());
    session().persistNow();
    ui.confirm = null; ui.overlay = 'final';
    renderGame();
  },
  'csv': () => copyCsv(historyCsv(currentGame())),
  'csv-box': () => copyCsv(boxScoreCsv(currentGame()))
};

/** Todas las acciones del partido; no hacen nada si no hay partido abierto. */
export const gameActions = Object.fromEntries(
  Object.entries(handlers).map(([name, fn]) => [name, (ctx) => { if (currentGame()) fn(ctx); }])
);

/* ---------- cancha, teclado, cambios de formulario ---------- */

function onCourtClick(event) {
  const court = event.target.closest && event.target.closest('#court');
  if (!court || state.view !== 'game' || !currentGame() || ui.overlay) return false;
  const ctm = court.getScreenCTM();
  if (!ctm) return true;
  const pt = court.createSVGPoint();
  pt.x = event.clientX; pt.y = event.clientY;
  const q = pt.matrixTransform(ctm.inverse());
  const spot = clampToCourt(q.x, q.y);
  if (!spot) return true;
  if (ui.pending && ui.step !== 'loc' && ui.step !== 'staff') { ui.pending.x = spot.x; ui.pending.y = spot.y; }
  else { ui.pending = captureMoment(currentGame(), spot.x, spot.y); ui.step = 'player'; }
  renderPanel();
  renderDots();
  return true;
}

function onDraftChange(event) {
  const id = event.target.id;
  if (ui.draft && (id === 'e-type' || id === 'e-who' || id === 'e-att')) { readDraft(); renderOverlay(); }
}

function onGameKey(event) {
  if (state.view !== 'game' || !currentGame()) return false;
  const tag = (event.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return false;
  if (event.code === 'Space' && !ui.overlay) { event.preventDefault(); toggleGameClock(); }
  if (event.key === 'Escape') {
    if (ui.overlay === 'forced') return true;
    if (ui.overlay) { ui.overlay = null; ui.draft = null; renderOverlay(); }
    else if (ui.step !== 'loc') { ui.step = 'loc'; ui.pending = null; renderPanel(); renderDots(); }
  }
  return true;
}

export function registerGameHandlers() {
  onClickBefore(onCourtClick);
  onChange(onDraftChange);
  onKeydown(onGameKey);
  document.addEventListener('visibilitychange', () => { if (state.view === 'game') keepScreenOn(); });
}
