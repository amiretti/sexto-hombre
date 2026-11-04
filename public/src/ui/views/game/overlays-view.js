// Hojas superpuestas del partido: historial, planilla, cambios, reloj, menú, final y cambio obligatorio.

import { esc } from '../../../shared/html.js';
import { EVENT_LABELS, TURNOVER_KINDS, PERSONAL_FOUL_KINDS, EDITABLE_EVENT_TYPES, STAFF_EVENT_TYPES, isStaff } from '../../../domain/catalog.js';
import { periodShort, periodLong, remainingMs, formatSeconds, overtimeCount } from '../../../domain/clock.js';
import { zoneName } from '../../../domain/court.js';
import {
  playerStats, ourScore, opponentScore, teamFouls, staffFouls, eventPoints, eventsNewestFirst, teamTotals, requiredOnCourt, percent
} from '../../../domain/stats.js';
import { findPlayer, whoLabel, eventDetail, eventCategory } from '../../../domain/describe.js';
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
  if (d.type !== 'SUB') {
    h += '<label>Quién<select id="e-who">' + G.roster.map((p) => '<option value="' + p.id + '"' + (d.who === p.id ? ' selected' : '') + '>#' + esc(p.num) + ' ' + esc(p.name) + '</option>').join('') +
      '<option value="coach"' + (d.who === 'coach' ? ' selected' : '') + '>DT</option><option value="bench"' + (d.who === 'bench' ? ' selected' : '') + '>Banca</option></select></label>';
    h += '<label>Acción<select id="e-type">' + options(isStaff(d.who) ? STAFF_EVENT_TYPES : EDITABLE_EVENT_TYPES, d.type, (t) => EVENT_LABELS[t], (t) => t) + '</select></label>';
    if (d.type === 'TOV' || d.type === 'PF') {
      const src = d.type === 'TOV' ? TURNOVER_KINDS : PERSONAL_FOUL_KINDS;
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
  h += '<div class="acts"><span class="err" id="e-err">' + esc(d.err || '') + '</span><button class="btn" data-a="cancel-edit">Cancelar</button><button class="btn primary" data-a="save-edit">Guardar cambios</button></div></div>';
  return h;
}

function historyRow(G, e) {
  const armed = ui.confirm === 'del-' + e.id, d = eventDetail(G, e), z = e.type !== 'SUB' && e.x != null ? zoneName(e.x, e.y) : '';
  const pts = eventPoints(e);
  let h = '<li class="hrow"><span class="per2">' + periodShort(e.period) + '</span><span class="t">' + formatSeconds(e.t) + '</span><span class="who">' + esc(e.type === 'SUB' ? 'Cambio' : whoLabel(G, e.who, false)) + '</span>' +
    '<span class="what"><span class="tag ' + eventCategory(e) + '"></span>' + esc(e.type === 'SUB' ? '' : EVENT_LABELS[e.type]) + (d || z ? '<small>' + esc([d, z].filter(Boolean).join(' · ')) + '</small>' : '') + '</span>' +
    '<span class="pts">' + (pts ? '+' + pts : '') + '</span><span class="hact"><button class="btn" data-a="edit" data-id="' + e.id + '">Editar</button><button class="btn danger' + (armed ? ' armed' : '') + '" data-a="del" data-id="' + e.id + '">' + (armed ? '¿Borrar?' : 'Borrar') + '</button></span>';
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
  return '<tr class="' + (s.out ? 'out' : '') + '"><td class="n">' + esc(p.num) + '</td><td class="l">' + esc(p.name || '—') + (G.onCourt.includes(p.id) ? ' <span class="chip">en cancha</span>' : '') + (s.out ? ' <span class="chip bad">' + s.outWhy + '</span>' : '') + '</td>' +
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
    '<div class="tablewrap"><table class="box"><thead><tr><th>Nº</th><th class="l">Jugador</th><th>PTS</th><th>T2</th><th>T3</th><th>TL</th><th>RO</th><th>RD</th><th>RT</th><th>AS</th><th>RB</th><th>TP</th><th>PE</th><th>FC</th><th>FR</th></tr></thead><tbody>' +
    G.roster.map((p) => boxRow(G, p)).join('') + '</tbody>' + boxFooter(teamTotals(G)) + '</table></div>' +
    '<div class="staffline"><span class="chip">Faltas de equipo · ' + tf + '</span><span class="chip' + (staffFouls(G).out ? ' bad' : '') + '">' + staffSummary(G) + '</span></div>' +
    '<p class="lead" style="font-size:.8rem">T2/T3/TL: convertidos/intentos · RO/RD/RT: rebotes · AS asistencias · RB robos · TP tapones · PE pérdidas · FC faltas cometidas · FR faltas recibidas.</p>');
}

/* ---------- cambios, reloj, menú ---------- */

function subsSheet(G) {
  const sel = ui.subSel, need = requiredOnCourt(G);
  const toggle = (p) => {
    const s = playerStats(G, p.id), on = sel.includes(p.id);
    return '<button class="stog" data-a="sub-tog" data-id="' + p.id + '" aria-pressed="' + on + '"' + (s.out && !on ? ' disabled' : '') + '><span class="pnum">' + esc(p.num) + '</span><span>' + esc(p.name || 'Jugador') + '<br><small>' + s.fouls + ' faltas' + (s.out ? ' · ' + s.outWhy : '') + '</small></span></button>';
  };
  return sheet('Cambios · ' + periodShort(G.period) + ' ' + clockNow(G), '<span class="chip ' + (sel.length === need ? 'ok' : 'bad') + '">' + sel.length + ' de ' + need + ' en cancha</span>',
    '<p class="lead">Marcá quiénes quedan en cancha. El cambio se registra con el tiempo actual del reloj.</p><div class="slist">' + G.roster.map(toggle).join('') +
    '</div><div class="row end"><button class="btn" data-a="close-ov">Cancelar</button><button class="btn primary big" data-a="sub-save"' + (sel.length !== need ? ' disabled' : '') + '>Confirmar cambio</button></div>', true);
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

function menuSheet(G) {
  const armed = ui.confirm === 'finish', fin = G.status === 'final';
  return sheet('Partido', '', '<p class="lead">' + esc(G.team) + ' vs ' + esc(G.opponent) + ' · ' + esc(G.date || '') + (G.competition ? ' · ' + esc(G.competition) : '') + ' · cuartos de ' + G.periodMin + ' min' + (G.coach ? ' · DT ' + esc(G.coach) : '') + '</p>' +
    '<p class="lead">' + (isDemo() ? 'Modo demo: el partido se guarda solo en este dispositivo.' : 'Cada jugada se guarda en tu cuenta. Sin señal queda en el dispositivo y se envía sola cuando vuelve la conexión.') + '</p>' +
    '<div class="row"><button class="btn share" data-a="share">Compartir planilla (PDF)</button><button class="btn" data-a="ov" data-o="box">Ver planilla</button><button class="btn" data-a="ov" data-o="history">Ver historial</button></div>' +
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

function forcedDialog(G) {
  const F = ui.forced, fp = findPlayer(G, F.out), cands = benchCandidates(G);
  const candidate = (p) => '<button class="stog" data-a="forced-pick" data-id="' + p.id + '"><span class="pnum">' + esc(p.num) + '</span><span>' + esc(p.name || 'Jugador') + '<br><small>' + playerStats(G, p.id).fouls + ' faltas</small></span></button>';
  return '<section class="sheet small" role="dialog" aria-label="Cambio obligatorio"><div class="sheet-head"><div class="forced-head"><span class="eyebrow">Reloj detenido · ' + periodShort(G.period) + ' ' + clockNow(G) + '</span>' +
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
  menu: { html: menuSheet, scrim: CLOSABLE_SCRIM },
  final: { html: finalDialog, scrim: CLOSABLE_SCRIM },
  forced: { html: forcedDialog, scrim: '<div class="scrim"></div>' }
};

export function renderOverlay() {
  const el = $('#overlay');
  if (!el) return;
  const o = OVERLAYS[ui.overlay];
  el.innerHTML = o ? o.scrim + o.html(currentGame()) : (ui.overlay ? CLOSABLE_SCRIM : '');
  renderDots();
}
