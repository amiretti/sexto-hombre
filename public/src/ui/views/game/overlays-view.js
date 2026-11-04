// Hojas superpuestas del partido: historial, planilla, cambios, reloj, menú, final y cambio obligatorio.

import { esc } from '../../../shared/html.js';
import { focusKey, focusQuiet } from '../../focus.js';
import { isBuzzerEnabled } from '../../../infrastructure/platform/buzzer.js';
import { EVENT_LABELS, hasSubtype, subtypeKinds, isTeamEvent, EDITABLE_EVENT_TYPES, STAFF_EVENT_TYPES, isStaff } from '../../../domain/catalog.js';
import { periodShort, periodLong, remainingMs, formatSeconds, overtimeCount } from '../../../domain/clock.js';
import { zoneName } from '../../../domain/court.js';
import {
  playerStats, ourScore, opponentScore, teamFouls, staffFouls, eventPoints, eventsNewestFirst, teamTotals, requiredOnCourt, percent
} from '../../../domain/stats.js';
import { findPlayer, shortName, whoLabel, eventDetail, eventCategory, eventActor } from '../../../domain/describe.js';
import { benchCandidates } from '../../../domain/game.js';
import { $ } from '../../dom.js';
import { ui, currentGame, isDemo } from '../../state.js';
import { renderDots } from './court-svg.js';
import { staffSummary } from './panel-view.js';

const clockNow = (G) => formatSeconds(remainingMs(G.clock) / 1000);

/** Hoja estándar. `title` ya viene como HTML. */
function sheet(title, extra, body, small) {
  return '<section class="sheet' + (small ? ' small' : '') + '" role="dialog" aria-label="' + esc(title) + '"><div class="sheet-head"><h2>' + title + '</h2><div class="row">' + extra + '<button class="btn" data-a="close-ov">Cerrar</button></div></div><div class="sheet-body">' +
    (ui.csv ? '<p class="lead">No se pudo copiar automáticamente. Seleccioná el texto y copialo:</p><textarea class="csv" id="csv-out" readonly>' + esc(ui.csv) + '</textarea>' : '') + body + '</div></section>';
}

/* ---------- historial ---------- */

function options(values, selected, label = (v) => v, value = null) {
  return values.map((v) => '<option' + (value ? ' value="' + value(v) + '"' : '') + (selected === v ? ' selected' : '') + '>' + label(v) + '</option>').join('');
}

function editForm(G, d) {
  let h = '<div class="edit">';
  if (!isTeamEvent(d.type)) {
    h += '<label>Quién<select id="e-who">' + G.roster.map((p) => '<option value="' + esc(p.id) + '"' + (d.who === p.id ? ' selected' : '') + '>#' + esc(p.num) + ' ' + esc(p.name) + '</option>').join('') +
      '<option value="coach"' + (d.who === 'coach' ? ' selected' : '') + '>DT</option><option value="bench"' + (d.who === 'bench' ? ' selected' : '') + '>Banca</option></select></label>';
    h += '<label>Acción<select id="e-type">' + options(isStaff(d.who) ? STAFF_EVENT_TYPES : EDITABLE_EVENT_TYPES, d.type, (t) => EVENT_LABELS[t], (t) => t) + '</select></label>';
    if (hasSubtype(d.type)) {
      const src = subtypeKinds(d.type);
      h += '<label>Detalle<select id="e-sub">' + options(Object.keys(src), d.sub, (k) => src[k], (k) => k) + '</select></label>';
    }
    if (d.type === 'FT') {
      h += '<label>Intentos<select id="e-att">' + options([1, 2, 3], d.att) + '</select></label>' +
        '<label>Convertidos<select id="e-made">' + options([0, 1, 2, 3], d.made) + '</select></label>';
    }
  }
  let po = '';
  for (let p = 1; p <= Math.max(G.period, d.period, 4); p++) po += '<option value="' + p + '"' + (d.period === p ? ' selected' : '') + '>' + periodLong(p) + '</option>';
  h += '<label>Período<select id="e-per">' + po + '</select></label><label>Tiempo (reloj)<input id="e-time" inputmode="decimal" value="' + esc(d.timeStr) + '" placeholder="7:32 o 45.3"></label>';
  h += '<div class="acts"><span class="err" id="e-err" role="alert">' + esc(d.err || '') + '</span><button class="btn" data-a="cancel-edit">Cancelar</button><button class="btn primary" data-a="save-edit">Guardar cambios</button></div></div>';
  return h;
}

function historyRow(G, e) {
  const armed = ui.confirm === 'del-' + e.id, d = eventDetail(G, e), z = !isTeamEvent(e.type) && e.x != null ? zoneName(e.x, e.y) : '';
  const pts = eventPoints(e);
  const rowName = periodShort(e.period) + ' ' + formatSeconds(e.t) + ' ' + eventActor(G, e) + ' ' + (EVENT_LABELS[e.type] || '');
  let h = '<li class="hrow"><span class="per2">' + periodShort(e.period) + '</span><span class="t">' + formatSeconds(e.t) + '</span><span class="who">' + esc(eventActor(G, e)) + '</span>' +
    '<span class="what"><span class="tag ' + eventCategory(e) + '"></span>' + esc(e.type === 'SUB' ? '' : EVENT_LABELS[e.type]) + (d || z ? '<small>' + esc([d, z].filter(Boolean).join(' · ')) + '</small>' : '') + '</span>' +
    '<span class="pts">' + (pts ? '+' + pts : '') + '</span><span class="hact"><button class="btn" data-a="edit" data-id="' + esc(e.id) + '" aria-label="' + esc('Editar jugada ' + rowName) + '">Editar</button><button class="btn danger' + (armed ? ' armed' : '') + '" data-a="del" data-id="' + esc(e.id) + '" aria-label="' + esc((armed ? 'Confirmar borrar jugada ' : 'Borrar jugada ') + rowName) + '">' + (armed ? '¿Borrar?' : 'Borrar') + '</button></span>';
  if (ui.draft && ui.draft.id === e.id) h += editForm(G, ui.draft);
  return h + '</li>';
}

function historySheet(G) {
  const ev = eventsNewestFirst(G);
  return sheet('Historial · ' + ev.length + ' jugadas', '<button class="btn" data-a="csv">Copiar CSV</button>',
    ev.length ? '<ul class="hlist">' + ev.map((e) => historyRow(G, e)).join('') + '</ul>' : '<p class="empty">Sin jugadas registradas.</p>');
}

/* ---------- planilla ---------- */

function foulsCell(s) {
  return s.fouls + (s.tf || s.uf ? ' <small>(' + (s.tf ? s.tf + 'T' : '') + (s.uf ? ' ' + s.uf + 'U' : '') + ')</small>' : '');
}

function boxRow(G, p) {
  const s = playerStats(G, p.id);
  return '<tr class="' + (s.out ? 'out' : '') + '"><td class="n">' + esc(p.num) + '</td><td class="l">' + esc(p.name || '—') + (G.onCourt.includes(p.id) ? ' <span class="oncourt" title="En cancha"><span class="visually-hidden">en cancha</span></span>' : '') + (s.out ? ' <span class="chip bad">' + s.outWhy + '</span>' : '') + '</td>' +
    '<td class="p">' + s.pts + '</td><td>' + s.m2 + '/' + s.a2 + '</td><td>' + s.m3 + '/' + s.a3 + '</td><td>' + s.ftm + '/' + s.fta + '</td><td>' + s.ro + '</td><td>' + s.rd + '</td><td>' + (s.ro + s.rd) + '</td>' +
    '<td>' + s.ast + '</td><td>' + s.stl + '</td><td>' + s.blk + '</td><td>' + s.tov + '</td><td>' + foulsCell(s) + '</td><td>' + s.fd + '</td></tr>';
}

function boxFooter(T) {
  return '<tfoot><tr><td></td><td class="l">Equipo</td><td class="p">' + T.pts + '</td><td>' + T.m2 + '/' + T.a2 + ' <small>' + percent(T.m2, T.a2) + '</small></td><td>' + T.m3 + '/' + T.a3 + ' <small>' + percent(T.m3, T.a3) + '</small></td><td>' + T.ftm + '/' + T.fta + ' <small>' + percent(T.ftm, T.fta) + '</small></td>' +
    '<td>' + T.ro + '</td><td>' + T.rd + '</td><td>' + (T.ro + T.rd) + '</td><td>' + T.ast + '</td><td>' + T.stl + '</td><td>' + T.blk + '</td><td>' + T.tov + '</td><td>' + T.fouls + '</td><td>' + T.fd + '</td></tr></tfoot>';
}

function boxSheet(G) {
  const tf = [1, 2, 3, 4].map((p) => periodShort(p) + ': ' + teamFouls(G, p)).join(' · ');
  return sheet('Planilla · ' + esc(G.team) + ' ' + ourScore(G) + ' – ' + opponentScore(G) + ' ' + esc(G.opponent), '<button class="btn share" data-a="share">Compartir PDF</button><button class="btn" data-a="csv-box">Copiar CSV</button>',
    '<p class="swipe-hint">Deslizá la tabla para ver todas las columnas →</p><div class="tablewrap" tabindex="0" role="region" aria-label="Planilla por jugador"><table class="box"><caption class="visually-hidden">Planilla por jugador</caption><thead><tr><th scope="col"><abbr title="Número">Nº</abbr></th><th scope="col" class="l">Jugador</th><th scope="col"><abbr title="Puntos">PTS</abbr></th><th scope="col"><abbr title="Dobles convertidos/intentados">T2</abbr></th><th scope="col"><abbr title="Triples convertidos/intentados">T3</abbr></th><th scope="col"><abbr title="Tiros libres convertidos/intentados">TL</abbr></th><th scope="col"><abbr title="Rebotes ofensivos">RO</abbr></th><th scope="col"><abbr title="Rebotes defensivos">RD</abbr></th><th scope="col"><abbr title="Rebotes totales">RT</abbr></th><th scope="col"><abbr title="Asistencias">AS</abbr></th><th scope="col"><abbr title="Robos">RB</abbr></th><th scope="col"><abbr title="Tapones">TP</abbr></th><th scope="col"><abbr title="Pérdidas">PE</abbr></th><th scope="col"><abbr title="Faltas cometidas">FC</abbr></th><th scope="col"><abbr title="Faltas recibidas">FR</abbr></th></tr></thead><tbody>' +
    G.roster.map((p) => boxRow(G, p)).join('') + '</tbody>' + boxFooter(teamTotals(G)) + '</table></div>' +
    '<div class="staffline"><span class="chip">Faltas de equipo · ' + tf + '</span><span class="chip' + (staffFouls(G).out ? ' bad' : '') + '">' + staffSummary(G) + '</span></div>' +
    '<p class="lead" style="font-size:.8rem">T2/T3/TL: convertidos/intentos · RO/RD/RT: rebotes · AS asistencias · RB robos · TP tapones · PE pérdidas · FC faltas cometidas · FR faltas recibidas.</p>');
}

/* ---------- cambios, reloj, menú ---------- */

/** Cambios en dos columnas: los que están en cancha (tocar = sale) y la banca (tocar = entra). */
function subsSheet(G) {
  const sel = ui.subSel, need = requiredOnCourt(G);
  const onCourt = G.onCourt.map((id) => findPlayer(G, id)).filter(Boolean);
  const bench = G.roster.filter((p) => !G.onCourt.includes(p.id)).sort((a, b) => (+a.num || 0) - (+b.num || 0));
  const card = (p, side) => {
    const s = playerStats(G, p.id), on = sel.includes(p.id);
    const state = side === 'court' ? (on ? 'Sigue' : 'Sale') : (on ? 'Entra' : '');
    const label = (side === 'court' ? (on ? 'Sacar a ' : 'Dejar en cancha a ') : (on ? 'No hacer entrar a ' : 'Hacer entrar a ')) + '#' + p.num + ' ' + (p.name || '');
    return '<button class="stog ' + side + (state ? ' ' + state.toLowerCase() : '') + '" data-a="sub-tog" data-id="' + esc(p.id) + '" aria-pressed="' + on + '" aria-label="' + esc(label) + '"' + (s.out && !on ? ' disabled' : '') + '>' +
      '<span class="pnum">' + esc(p.num) + '</span><span>' + esc(p.name || 'Jugador') + '<br><small>' + s.fouls + (s.fouls === 1 ? ' falta' : ' faltas') + (s.out ? ' · ' + s.outWhy : '') + '</small></span>' +
      (state ? '<span class="stag">' + state + '</span>' : '') + '</button>';
  };
  const outs = onCourt.filter((p) => !sel.includes(p.id)), ins = bench.filter((p) => sel.includes(p.id));
  const who = (list) => list.map((p) => '#' + p.num + ' ' + shortName(p.name)).join(', ');
  const summary = outs.length || ins.length
    ? '<p class="subsum" role="status">' + (outs.length ? '<b>Sale</b> ' + esc(who(outs)) : '') + (outs.length && ins.length ? ' · ' : '') + (ins.length ? '<b>Entra</b> ' + esc(who(ins)) : '') + '</p>'
    : '<p class="lead">Tocá quién sale y quién entra. El cambio se registra con el tiempo actual del reloj.</p>';
  return sheet('Cambios · ' + periodShort(G.period) + ' ' + clockNow(G), '<span class="chip ' + (sel.length === need ? 'ok' : 'bad') + '">' + sel.length + ' de ' + need + ' en cancha</span>',
    summary + '<div class="subcols"><div><h3>En cancha</h3><div class="slist">' + onCourt.map((p) => card(p, 'court')).join('') + '</div></div>' +
    '<div><h3>Banca</h3><div class="slist">' + bench.map((p) => card(p, 'bench')).join('') + '</div></div></div>' +
    '<div class="row end"><button class="btn" data-a="close-ov">Cancelar</button><button class="btn primary big" data-a="sub-save"' + (sel.length !== need ? ' disabled' : '') + '>Confirmar cambio</button></div>', true);
}

function clockSheet(G) {
  const r = remainingMs(G.clock) / 1000, m = Math.floor(r / 60), s = Math.floor(r % 60);
  let opts = '';
  for (let p = 1; p <= Math.max(G.period + 1, 4); p++) opts += '<option value="' + p + '"' + (p === G.period ? ' selected' : '') + '>' + periodLong(p) + '</option>';
  return sheet('Ajustar reloj', '', '<div class="row"><label class="inline-field">Período<select id="c-per" style="width:12em">' + opts + '</select></label>' +
    '<label class="inline-field">Min<input id="c-m" inputmode="numeric" value="' + m + '"></label><label class="inline-field">Seg<input id="c-s" inputmode="numeric" value="' + s + '"></label></div>' +
    '<p class="lead">El reloj queda pausado al aplicar. Cambiar de período reinicia el reloj al tiempo cargado.</p>' +
    '<div class="row end"><button class="btn" data-a="close-ov">Cancelar</button><button class="btn primary big" data-a="clock-save">Aplicar</button></div>', true);
}

/** Sincronizar con el tablero: minutos y segundos, con atajos de ±10 s y ±1 s. El reloj sigue corriendo. */
function syncSheet(G) {
  const r = remainingMs(G.clock) / 1000, m = Math.floor(r / 60), s = Math.floor(r % 60);
  const step = (d, label) => '<button class="btn" data-a="sync-step" data-d="' + d + '">' + label + '</button>';
  return sheet('Sincronizar reloj', '', '<p class="lead">Poné el tiempo que marca el tablero ahora. El reloj sigue corriendo desde ahí y las jugadas que se cargaron con el reloj detenido toman ese tiempo.</p>' +
    '<div class="row timepick"><label class="inline-field">Min<input id="sync-m" inputmode="numeric" value="' + m + '"></label>' +
    '<span class="tsep">:</span><label class="inline-field">Seg<input id="sync-s" inputmode="numeric" value="' + String(s).padStart(2, '0') + '"></label></div>' +
    '<div class="row">' + step(-10, '−10 s') + step(-1, '−1 s') + step(1, '+1 s') + step(10, '+10 s') + '</div>' +
    '<div class="row end"><button class="btn" data-a="close-ov">Cancelar</button><button class="btn primary big" data-a="sync-save">Sincronizar</button></div>', true);
}

function menuSheet(G) {
  const armed = ui.confirm === 'finish', fin = G.status === 'final';
  return sheet('Partido', '', '<p class="lead">' + esc(G.team) + ' vs ' + esc(G.opponent) + ' · ' + esc(G.date || '') + (G.competition ? ' · ' + esc(G.competition) : '') + ' · cuartos de ' + G.periodMin + ' min' + (G.coach ? ' · DT ' + esc(G.coach) : '') + '</p>' +
    '<p class="lead">' + (isDemo() ? 'Modo demo: el partido se guarda solo en este dispositivo.' : 'Cada jugada se guarda en tu cuenta. Sin señal queda en el dispositivo y se envía sola cuando vuelve la conexión.') + '</p>' +
    '<div class="row"><button class="btn share" data-a="share">Compartir planilla (PDF)</button><button class="btn" data-a="ov" data-o="box">Ver planilla</button><button class="btn" data-a="ov" data-o="history">Ver historial</button></div>' +
    '<div class="row"><button class="btn" data-a="buzzer-toggle" aria-pressed="' + isBuzzerEnabled() + '">Chicharra al terminar el tiempo: ' + (isBuzzerEnabled() ? 'activada' : 'silenciada') + '</button></div>' +
    '<div class="row end"><button class="btn" data-a="go-home">Volver a mis partidos</button>' +
    (fin ? '<span class="chip ok">Partido finalizado</span>' : '<button class="btn danger' + (armed ? ' armed' : '') + '" data-a="finish">' + (armed ? 'Tocá de nuevo para finalizar' : 'Finalizar partido') + '</button>') + '</div>' +
    '<p class="lead" style="font-size:.8rem">Finalizá el partido si no terminó con el reloj (por ejemplo, si no lo usaste). Podés seguir corrigiendo jugadas después.</p>', true);
}

/* ---------- diálogos propios (final, cambio obligatorio) ---------- */

function finalDialog(G) {
  const ot = overtimeCount(G.period);
  return '<section class="sheet small" role="dialog" aria-label="Final del partido"><div class="sheet-head"><div class="forced-head"><span class="eyebrow">Final del partido' + (ot ? ' · ' + ot + ' suplementario' + (ot > 1 ? 's' : '') : '') + '</span>' +
    '<strong class="final-score">' + esc(G.team) + ' ' + ourScore(G) + ' – ' + opponentScore(G) + ' ' + esc(G.opponent) + '</strong></div></div><div class="sheet-body">' +
    '<p class="lead">¿Querés compartir la planilla? Se genera un PDF con los datos del encuentro y la planilla por jugador.</p>' +
    '<div class="row end"><button class="btn" data-a="close-ov">Ahora no</button><button class="btn primary big" data-a="share" data-close="1">Compartir planilla</button></div></div></section>';
}

const foulsText = (n) => n + (n === 1 ? ' falta' : ' faltas');

function forcedDialog(G) {
  const F = ui.forced, fp = findPlayer(G, F.out), cands = benchCandidates(G);
  const candidate = (p) => '<button class="stog" data-a="forced-pick" data-id="' + esc(p.id) + '"><span class="pnum">' + esc(p.num) + '</span><span>' + esc(p.name || 'Jugador') + '<br><small>' + foulsText(playerStats(G, p.id).fouls) + '</small></span></button>';
  return '<section class="sheet small" role="alertdialog" aria-label="Cambio obligatorio"><div class="sheet-head"><div class="forced-head"><span class="eyebrow">Reloj detenido · ' + periodShort(G.period) + ' ' + clockNow(G) + '</span>' +
    '<strong>#' + esc(fp.num) + ' ' + esc(fp.name || '') + ' · ' + esc(F.why) + '</strong></div></div><div class="sheet-body">' +
    (cands.length ? '<p class="lead">Tiene que salir. Elegí quién entra:</p><div class="slist">' + cands.map(candidate).join('') + '</div>'
      : '<p class="lead">No quedan jugadores habilitados en la banca. El equipo sigue con uno menos en cancha.</p><div class="row end"><button class="btn primary big" data-a="forced-none">Seguir con uno menos</button></div>') +
    '<div class="row end"><button class="btn ghost" data-a="forced-undo">Fue un error: deshacer la falta</button></div></div></section>';
}

const CLOSABLE_SCRIM = '<div class="scrim" data-a="close-ov"></div>';

/** Cada overlay: html(G) y el fondo (el cambio obligatorio no se cierra tocando afuera). */
const OVERLAYS = {
  history: { html: historySheet, scrim: CLOSABLE_SCRIM },
  box: { html: boxSheet, scrim: CLOSABLE_SCRIM },
  subs: { html: subsSheet, scrim: CLOSABLE_SCRIM },
  clock: { html: clockSheet, scrim: CLOSABLE_SCRIM },
  sync: { html: syncSheet, scrim: CLOSABLE_SCRIM },
  menu: { html: menuSheet, scrim: CLOSABLE_SCRIM },
  final: { html: finalDialog, scrim: CLOSABLE_SCRIM },
  forced: { html: forcedDialog, scrim: '<div class="scrim"></div>' }
};

/* ---------- foco y modalidad ---------- */

let openOverlay = null;   // overlay abierto en el render anterior
let openerKey = null;     // control que lo abrió (para devolverle el foco)
let editingId = null;     // jugada en edición en el render anterior

/** Con un diálogo abierto, el fondo no se puede tocar ni recorrer con Tab. */
function setBackgroundInert(on) {
  document.querySelectorAll('.game > .board, .game > .stage').forEach((n) => { n.inert = on; });
}

function afterOverlayRender(el, prev, cur, prevFocusKey) {
  const dialog = el.querySelector('[role="dialog"], [role="alertdialog"]');
  if (dialog) { dialog.setAttribute('aria-modal', 'true'); dialog.tabIndex = -1; }
  setBackgroundInert(!!cur);
  if (cur && !prev) { focusQuiet(dialog); return; }                  // se abrió: foco al diálogo
  if (!cur && prev) {                                                 // se cerró: foco a quien lo abrió
    const back = openerKey && document.querySelector(openerKey);
    focusQuiet(back || document.querySelector('#clock'));
    return;
  }
  if (!cur) return;
  // Mismo diálogo redibujado: edición de jugada → primer campo; al cerrar la edición → su botón «Editar».
  if (ui.draft && ui.draft.id !== editingId) { focusQuiet(el.querySelector('.edit select, .edit input')); return; }
  if (!ui.draft && editingId) { focusQuiet(el.querySelector('[data-a="edit"][data-id="' + CSS.escape(editingId) + '"]') || dialog); return; }
  const same = prevFocusKey && el.querySelector(prevFocusKey);
  if (same) focusQuiet(same);
  else if (!el.contains(document.activeElement)) focusQuiet(dialog);
}

export function renderOverlay() {
  const el = $('#overlay');
  if (!el) return;
  const prev = openOverlay, cur = ui.overlay || null;
  const active = document.activeElement;
  if (cur && !prev) openerKey = focusKey(active);
  const prevFocusKey = el.contains(active) ? focusKey(active) : null;
  const o = OVERLAYS[ui.overlay];
  el.innerHTML = o ? o.scrim + o.html(currentGame()) : (ui.overlay ? CLOSABLE_SCRIM : '');
  afterOverlayRender(el, prev, cur, prevFocusKey);
  openOverlay = cur;
  editingId = ui.draft ? ui.draft.id : null;
  renderDots();
}
