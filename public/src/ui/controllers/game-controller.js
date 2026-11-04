// Controlador de la pantalla del partido: traduce toques y teclas en casos de uso y redibuja.

import { EVENT_LABELS, FREE_THROWS_FOR, isLiveBallAction } from '../../domain/catalog.js';
import { periodLengthSec, periodLong, toggleClock, adjustClock, remainingMs, runClockFrom, formatSeconds } from '../../domain/clock.js';
import { clampToCourt, flipAttackingSide, attackingSide } from '../../domain/court.js';
import { ourScore, opponentScore, requiredOnCourt, inLastTwoMinutes } from '../../domain/stats.js';
import { whoLabel } from '../../domain/describe.js';
import {
  captureMoment, lastLoggedEvent, adjustOpponentScore, applySubstitution, applyForcedSubstitution, substitutionEvent,
  applyLateSubstitution, substitutionEventAt, advancePeriod, setClockManually, finishGame, tickClock, newEditDraft, normalizeEditDraft, applyEditDraft
} from '../../domain/game.js';
import { buildGameReport } from '../../application/game-report.js';
import { historyCsv, boxScoreCsv } from '../../application/csv-export.js';
import { buildPdf } from '../../infrastructure/pdf/pdf-renderer.js';
import { sharePdf } from '../../infrastructure/pdf/share.js';
import { copyToClipboard, keepScreenOn } from '../../infrastructure/platform/device.js';
import { playBuzzer, unlockAudio, isBuzzerEnabled, setBuzzerEnabled } from '../../infrastructure/platform/buzzer.js';
import { app, state, ui, currentGame, isDemo } from '../state.js';
import { $ } from '../dom.js';
import { toast, hideToast } from '../toast.js';
import { onClickBefore, onChange, onKeydown } from '../events.js';
import { persistView } from '../navigation.js';
import { renderGame, renderBoard, renderPanel, renderOverlay, renderDots, tickClockDisplay } from '../views/game/game-view.js';

const TICK_MS = 100;
/** Cuánto queda visible el chip «Reloj estaba detenido». */
const CLOCK_NOTICE_MS = 20 * 1000;
const session = () => app.session;

/* ---------- pasos de carga ---------- */

function resetPlayFlow() {
  ui.step = 'loc';
  ui.pending = null;
  ui.player = null;
  ui.assistFor = null;
  ui.benchPick = null;
}

const isFieldGoalMade = (type) => type === '2M' || type === '3M';

/** Después de un gol: pregunta por la asistencia (o vuelve a ubicación si no hay a quién asignarla). */
function askAssistOrReset(scorer, moment) {
  const others = currentGame().onCourt.filter((id) => id !== scorer);
  resetPlayFlow();
  if (!others.length) return;
  // La pregunta queda arriba del paso Ubicación: no bloquea la jugada siguiente.
  ui.assistFor = { scorer, moment: { ...moment, x: null, y: null } };
}

function recordAssist(playerId) {
  const a = ui.assistFor;
  if (!a) return;
  const r = session().recordPlay(a.moment, { type: 'AST', who: playerId });
  if (!r.error) autoStartClock({ type: 'AST' }, r.event);
  resetPlayFlow();
  renderGame();
  if (r.error) toast(r.error, true); else toast('Asistencia: ' + whoLabel(currentGame(), playerId), false, r.event.id);
}

function goToStep(step) {
  ui.step = step;
  renderPanel();
}

function startPlayAt(x, y, step) {
  ui.assistFor = null;
  ui.pending = captureMoment(currentGame(), x, y);
  ui.step = step;
  renderPanel();
  renderDots();
}

/**
 * Si se carga una acción con la pelota viva y el reloj estaba detenido, lo pone a correr y
 * deja un aviso para sincronizarlo con el tablero (recuerda qué jugadas quedaron con el tiempo viejo).
 */
function autoStartClock(action, event) {
  const G = currentGame(), c = G.clock;
  const note = ui.clockNotice;
  if (note && c.running) { note.eventIds.push(event.id); return; }
  if (c.running || c.rem <= 0 || !isLiveBallAction(action.type, action.sub)) return;
  toggleClock(c);
  ui.clockNotice = { stoppedAt: c.rem / 1000, eventIds: [event.id], expires: Date.now() + CLOCK_NOTICE_MS };
  renderBoard();
  persistView();
}

/** Sincronizar: el reloj corre desde lo que marca el tablero y las jugadas del aviso toman ese tiempo. */
function syncClock() {
  const G = currentGame(), note = ui.clockNotice;
  const m = parseInt($('#sync-m').value, 10) || 0, s = parseInt($('#sync-s').value, 10) || 0;
  const max = periodLengthSec(G, G.period), sec = Math.min(max, m * 60 + s);
  // Diferencia entre nuestro reloj y el tablero: se aplica a las jugadas cargadas desde que arrancó solo.
  const offset = sec - remainingMs(G.clock) / 1000;
  runClockFrom(G.clock, sec, max);
  if (note) {
    note.eventIds.forEach((id) => {
      const e = G.events.find((x) => x.id === id);
      if (!e || e.period !== G.period) return;
      e.t = Math.max(0, Math.min(max, Math.round((e.t + offset) * 10) / 10));
      session().updateEvent(e);
    });
  }
  ui.clockNotice = null; ui.overlay = null;
  persistView();
  renderGame();
  toast('Reloj sincronizado en ' + formatSeconds(sec));
}

function record(action) {
  const moment = ui.pending, who = action.who || ui.player, afterFoulAssist = ui.assistFor;
  const result = session().recordPlay(moment, { ...action, who });
  if (result.error) { toast(result.error, true); return; }
  autoStartClock(action, result.event);
  resetPlayFlow();
  if (isFieldGoalMade(action.type)) askAssistOrReset(who, moment);
  else if (action.type === 'FT' && afterFoulAssist) ui.assistFor = afterFoulAssist;
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

/**
 * Falta recibida. kind: none | shot2 | shot3 | and1-2 | and1-3.
 * Con tiro abre la carga de libres con la cantidad que corresponde; and-one registra además el gol.
 */
function recordFoulDrawn(kind) {
  const moment = ui.pending, who = ui.player;
  const and1 = kind.startsWith('and1');
  const sub = and1 ? 'and1' : kind;
  if (and1) {
    const basket = session().recordPlay(moment, { type: kind === 'and1-3' ? '3M' : '2M', who });
    if (basket.error) { toast(basket.error, true); return; }
    ui.assistFor = { scorer: who, moment: { ...moment, x: null, y: null } };
  }
  const r = session().recordPlay(moment, { type: 'FD', sub, who });
  if (r.error) { toast(r.error, true); return; }
  const shots = FREE_THROWS_FOR[sub] || 0;
  if (!shots) { resetPlayFlow(); renderGame(); toast(r.message, r.warn, r.event.id); return; }
  ui.pending = { ...moment, x: null, y: null };
  ui.ft = { att: shots, res: Array(shots).fill(null), afterFoul: true };
  ui.step = 'ft';
  renderGame();
  toast(r.message + '. Cargá ' + (shots === 1 ? 'el libre' : 'los libres') + '.', false, r.event.id);
}

/* ---------- reloj ---------- */

function toggleGameClock() {
  if (!toggleClock(currentGame().clock)) return;
  if (ui.clockNotice) ui.clockNotice = null;
  persistView();
  renderBoard();
}

function periodEndMessage(G) {
  if (G.period < 4) return 'Fin del ' + periodLong(G.period);
  const us = ourScore(G), them = opponentScore(G);
  if (us === them) return 'Empate ' + them + ' a ' + them + ': va a suplementario';
  return 'Final del partido: ' + G.team + ' ' + us + ' – ' + them + ' ' + G.opponent;
}

let enteredLastTwo = false;

function onTick() {
  const G = currentGame();
  if (state.view !== 'game' || !G || !G.clock.running) return;
  const what = tickClock(G);
  if (ui.clockNotice && Date.now() > ui.clockNotice.expires && ui.overlay !== 'sync') { ui.clockNotice = null; renderBoard(); }
  if (what === 'running') {
    tickClockDisplay();
    // Al entrar en los últimos 2 minutos del 4° cuarto cambian los tiempos muertos disponibles.
    const last = inLastTwoMinutes(G.period, remainingMs(G.clock) / 1000);
    if (last && !enteredLastTwo && ui.step === 'loc') renderPanel();
    enteredLastTwo = last;
    return;
  }
  playBuzzer(); // fin de período o de partido
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

/** Cambio olvidado: entra el jugador de la banca y se sigue con la jugada. */
function lateSubstitution(inId, outId) {
  const G = currentGame();
  const change = applyLateSubstitution(G, inId, outId);
  if (!change) { toast('No se pudo registrar el cambio.', true); return; }
  session().addEvent(substitutionEventAt(ui.pending, change));
  ui.benchPick = null;
  ui.player = inId;
  ui.step = 'action';
  persistView();
  renderGame();
  toast(outId ? 'Cambio registrado: entra ' + whoLabel(G, inId) + ' por ' + whoLabel(G, outId) : 'Entra ' + whoLabel(G, inId));
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
  if (err) {
    d.err = err; renderOverlay();
    const t = document.getElementById('e-time');
    if (t) { t.setAttribute('aria-invalid', 'true'); t.setAttribute('aria-describedby', 'e-err'); t.focus(); }
    return;
  }
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
  'sync-open': () => { ui.overlay = 'sync'; ui.csv = null; hideToast(); renderOverlay(); },
  'sync-save': () => syncClock(),
  'sync-dismiss': () => { ui.clockNotice = null; renderBoard(); },
  'sync-step': ({ data }) => {
    const mEl = $('#sync-m'), sEl = $('#sync-s');
    const G = currentGame(), max = periodLengthSec(G, G.period);
    const t = Math.max(0, Math.min(max, (parseInt(mEl.value, 10) || 0) * 60 + (parseInt(sEl.value, 10) || 0) + (+data.d)));
    mEl.value = Math.floor(t / 60); sEl.value = String(Math.floor(t % 60)).padStart(2, '0');
  },
  'stoppage': ({ data }) => {
    const r = session().recordStoppage(data.t, data.team);
    resetPlayFlow();
    renderGame();
    toast(r.message, r.warn, r.event.id);
  },
  'staff': () => startPlayAt(null, null, 'staff'),
  'cancel': () => {
    const pendingAssist = ui.step === 'ft' && ui.ft.afterFoul ? ui.assistFor : null;
    resetPlayFlow();
    if (pendingAssist) ui.assistFor = pendingAssist;
    renderPanel(); renderDots();
  },
  'pick': ({ id }) => {
    if (!currentGame().onCourt.includes(id)) { ui.benchPick = id; goToStep('bench'); return; }
    ui.player = id; goToStep('action');
  },
  'bench-back': () => { ui.benchPick = null; goToStep('player'); },
  'bench-sub': ({ id }) => lateSubstitution(ui.benchPick, id || null),
  'back': () => { ui.player = null; goToStep('player'); },
  'back-action': () => goToStep('action'),
  'act': ({ data }) => record({ type: data.t, sub: data.s }),
  'act-staff': ({ data }) => record({ type: data.t, who: data.w }),
  'foul': () => goToStep('foul'),
  'foul-drawn': () => goToStep('fdrawn'),
  'fd-kind': ({ data }) => recordFoulDrawn(data.s),
  'assist-pick': ({ id }) => recordAssist(id),
  'assist-none': () => { ui.assistFor = null; renderPanel(); },
  'attack-flip': () => {
    const G = currentGame();
    flipAttackingSide(G);
    persistView(); renderPanel(); renderDots();
    toast('Atacamos hacia la ' + (attackingSide(G) === 'right' ? 'derecha →' : '← izquierda'));
  },
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
  'ft-quick': ({ data }) => record({ type: 'FT', att: ui.ft.att, made: Math.min(+data.m, ui.ft.att) }),
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
  'buzzer-toggle': () => {
    setBuzzerEnabled(!isBuzzerEnabled());
    if (isBuzzerEnabled()) { unlockAudio(); playBuzzer(); }
    renderOverlay();
  },
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
  if (ui.step === 'loc') ui.assistFor = null; // tocar la cancha descarta la pregunta de asistencia
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
  // Espacio arranca/pausa el reloj solo si el foco no está en un control (si no, activa ese control).
  const onControl = event.target.closest && event.target.closest('button, a, [role=button], [role=radio], summary');
  if (event.code === 'Space' && !ui.overlay && !onControl) { event.preventDefault(); toggleGameClock(); }
  if (event.key === 'Escape') {
    if (ui.overlay === 'forced') return true;
    if (ui.overlay) { ui.overlay = null; ui.draft = null; renderOverlay(); }
    else if (ui.step !== 'loc') { resetPlayFlow(); renderPanel(); renderDots(); }
  }
  return true;
}

export function registerGameHandlers() {
  // El audio solo se habilita dentro de un toque: lo dejamos listo con el primero.
  onClickBefore(() => { unlockAudio(); return false; });
  onClickBefore(onCourtClick);
  onChange(onDraftChange);
  onKeydown(onGameKey);
  document.addEventListener('visibilitychange', () => { if (state.view === 'game') keepScreenOn(); });
}
