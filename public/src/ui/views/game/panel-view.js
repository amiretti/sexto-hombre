// Panel lateral: los pasos para cargar una jugada (ubicación → jugador → acción).

import { esc } from '../../../shared/html.js';
import { EVENT_LABELS, TURNOVER_KINDS, isTeamEvent } from '../../../domain/catalog.js';
import { periodShort, formatSeconds, remainingMs } from '../../../domain/clock.js';
import { isThreePointer, zoneName, attackingSide, courtHalf } from '../../../domain/court.js';
import { playerStats, playerFoulTypes, staffFouls, eventPoints, requiredOnCourt, timeoutsLeft, inLastTwoMinutes } from '../../../domain/stats.js';
import { findPlayer, shortName, whoLabel, eventDetail, eventActor } from '../../../domain/describe.js';
import { $ } from '../../dom.js';
import { ui, currentGame } from '../../state.js';

const STEP_NAMES = ['Ubicación', 'Jugador', 'Acción'];
const STEP_NUMBER = { loc: 1, player: 2, bench: 2, action: 3, foul: 3, fdrawn: 3, tov: 3, ft: 3, staff: 3, assist: 3 };
let announcedStep = null;

/** Lectores de pantalla: anuncia solo el cambio de paso (no todo el panel). */
function announceStep() {
  const n = STEP_NUMBER[ui.step];
  const el = $('#sr-status');
  if (!el || !n || ui.step === announcedStep) return;
  announcedStep = ui.step;
  el.textContent = ui.step === 'assist' ? '¿Hubo asistencia?' : 'Paso ' + n + ' de 3: ' + STEP_NAMES[n - 1];
}

function stepsBar(n) {
  return '<div class="steps">' + STEP_NAMES.map((x, i) => '<span class="' + (i + 1 === n ? 'on' : i + 1 < n ? 'done' : '') + '"' + (i + 1 === n ? ' aria-current="step"' : '') + '>' + (i + 1) + ' · ' + x + '</span>').join('') + '</div>';
}

/** "DT: 1 C · Banca: 0 B". */
export function staffSummary(game) {
  const s = staffFouls(game);
  return 'DT: ' + s.c + ' C · Banca: ' + s.b + ' B';
}

function whenText() {
  const p = ui.pending;
  if (!p) return '';
  const z = zoneName(p.x, p.y);
  return periodShort(p.period) + ' · ' + formatSeconds(p.t) + (z ? ' <small>· ' + z + '</small>' : ' <small>· sin ubicación</small>');
}

function titleBar(left, backAction, backLabel) {
  return '<div class="ptitle"><span class="when">' + left + '</span><button class="btn ghost" data-a="' + backAction + '">' + backLabel + '</button></div>';
}

function foulDots(G, pid) {
  const list = playerFoulTypes(G, pid);
  const techs = list.filter((t) => t !== 'PF').length;
  let h = '<span class="fd" role="img" aria-label="' + list.length + (list.length === 1 ? ' falta' : ' faltas') + (techs ? ' (' + techs + ' técnica' + (techs > 1 ? 's' : '') + ' o antideportiva' + (techs > 1 ? 's' : '') + ')' : '') + '">';
  for (let i = 0; i < Math.max(5, list.length); i++) {
    const t = list[i];
    h += '<i class="' + (t ? 'on' + (t !== 'PF' ? ' t' : '') : '') + '"></i>';
  }
  return h + '</span>';
}

function playerCard(G, id) {
  const p = findPlayer(G, id), s = playerStats(G, id);
  return '<button class="pcard' + (s.out ? ' out' : '') + '" data-a="pick" data-id="' + esc(id) + '"' + (s.out ? ' disabled' : '') + '><span class="pnum">' + esc(p.num) + '</span><span class="pname">' + esc(shortName(p.name) || 'Jugador') + '</span>' +
    foulDots(G, id) + (s.out ? '<span class="outtag">' + (s.fouls >= 5 && s.outWhy === '5 faltas' ? '5 faltas' : 'Descalif.') + '</span>' : '') + '</button>';
}

function actionButton(type, label) {
  return '<button class="abtn" data-a="act" data-t="' + type + '">' + label + '</button>';
}

function recentRow(G, e) {
  const d = eventDetail(G, e), pts = eventPoints(e);
  const what = e.type === 'SUB' ? d : EVENT_LABELS[e.type] + (d ? ' · ' + d : '');
  return '<li><span class="t">' + periodShort(e.period) + ' ' + formatSeconds(e.t) + '</span><span class="who">' + esc(eventActor(G, e)) + '</span><span class="what">' + esc(what) + '</span>' +
    (pts ? '<span class="pts">+' + pts + '</span>' : '<span></span>') + '</li>';
}

/** Acciones sin ubicación ni jugador: detienen el reloj en el acto. */
function stoppageButtons(G) {
  const sec = remainingMs(G.clock) / 1000, lastTwo = inLastTwoMinutes(G.period, sec);
  const to = (team, label) => {
    const left = timeoutsLeft(G, team, G.period, sec);
    return '<button class="abtn stop' + (left ? '' : ' dim') + '" data-a="stoppage" data-t="TO" data-team="' + team + '">' + label +
      '<small>' + (left === 0 ? 'no quedan' : left === 1 ? 'queda 1' : 'quedan ' + left) + (lastTwo ? ' · últ. 2 min' : '') + '</small></button>';
  };
  return '<h3 class="qtitle">Sin jugador · detienen el reloj</h3><div class="quick three">' +
    to('us', 'Tiempo muerto') + to('them', 'Tiempo muerto rival') +
    '<button class="abtn stop" data-a="stoppage" data-t="REV">Pedido de revisión<small>video / árbitros</small></button></div>';
}

function locationStep(G) {
  const rec = G.events.slice(-5).reverse();
  return stepsBar(1) + '<p class="lead">Tocá la cancha donde fue la jugada. El tiempo se toma en ese momento.</p>' +
    '<div class="quick"><button class="abtn" data-a="noloc">Sin ubicación<small>libres, técnicas</small></button><button class="abtn tech" data-a="staff">Técnica DT / banca<small>' + staffSummary(G) + '</small></button></div>' +
    stoppageButtons(G) +
    '<div class="ptitle"><h3>Últimas jugadas</h3>' + (rec.length ? '<button class="btn ghost" data-a="undo">Deshacer última</button>' : '') + '</div>' +
    (rec.length ? '<ul class="recent">' + rec.map((e) => recentRow(G, e)).join('') + '</ul>' : '<p class="empty">Todavía no hay jugadas. Arrancá el reloj tocándolo y marcá la primera en la cancha.</p>');
}

function playerStep(G) {
  const bench = G.roster.filter((p) => !G.onCourt.includes(p.id)).map((p) => p.id);
  return stepsBar(2) + titleBar(whenText(), 'cancel', 'Cancelar') +
    '<h3>En cancha</h3><div class="pgrid five">' + G.onCourt.map((id) => playerCard(G, id)).join('') + '</div>' +
    (bench.length ? '<h3>Banca</h3><div class="pgrid bench">' + bench.map((id) => playerCard(G, id)).join('') + '</div>' : '') +
    '<p class="lead" style="font-size:.82rem">¿Ubicación equivocada? Tocá de nuevo la cancha para moverla.</p>';
}

/** ¿La ubicación tocada sugiere un tiro de 3? null si no hay ubicación. Usa el aro que atacamos si se sabe. */
function suggestsThree(G, p) {
  if (!p || p.x == null) return null;
  return isThreePointer(p.x, p.y, attackingSide(G, p.period) || undefined);
}

/** Clase para resaltar la opción sugerida (` sugg`) o atenuar la otra (` dim`). */
function hintClass(three, isThreeOption) {
  return three === null ? '' : (isThreeOption === three ? ' sugg' : ' dim');
}

function attackGroup(three) {
  const shot = (t, label, cls, isThree) => '<button class="abtn ' + cls + hintClass(three, isThree) + '" data-a="act" data-t="' + t + '">' + label + '</button>';
  return '<div class="agroup"><h3>Ataque</h3><div class="agrid">' +
      shot('2M', 'Doble<small>convertido</small>', 'make', false) + shot('2X', 'Doble<small>errado</small>', 'miss', false) +
      shot('3M', 'Triple<small>convertido</small>', 'make', true) + shot('3X', 'Triple<small>errado</small>', 'miss', true) +
      '<button class="abtn wide" data-a="ft">Tiros libres</button></div>' +
    '<div class="agrid three">' +
      actionButton('RO', 'Rebote<small>ofensivo</small>') +
      '<button class="abtn" data-a="foul-drawn">Falta recibida<small>¿en tiro?</small></button>' +
      '<button class="abtn" data-a="act" data-t="TOV" data-s="pasos">Pasos<small>caminata</small></button>' +
      '<button class="abtn wide" data-a="tov">Pérdida…<small>mal pase, doble, 3 seg, 24 seg, campo atrás</small></button></div></div>';
}

function defenseGroup() {
  return '<div class="agroup"><h3>Defensa</h3><div class="agrid">' +
    actionButton('RD', 'Rebote<small>defensivo</small>') +
    '<button class="abtn foul" data-a="foul">Falta personal<small>cometida</small></button>' +
    actionButton('STL', 'Robo') + actionButton('BLK', 'Tapón') + '</div></div>';
}

/** Faltas poco frecuentes, plegadas para que las acciones habituales entren sin scroll. */
function technicalGroup() {
  return '<details class="agroup more"><summary>Técnica, antideportiva o descalificante</summary><div class="agrid">' +
    '<button class="abtn tech" data-a="act" data-t="TF">Técnica</button><button class="abtn tech" data-a="act" data-t="UF">Antideportiva</button>' +
    '<button class="abtn tech wide" data-a="act" data-t="DF">Descalificante</button></div></details>';
}

/** Acciones ordenadas según dónde fue la jugada: en campo propio primero las defensivas. */
function actionStep(G) {
  const p = ui.pending, three = suggestsThree(G, p);
  const half = courtHalf(G, p.x, p.period);
  const groups = half === 'def' ? defenseGroup() + attackGroup(three) : attackGroup(three) + defenseGroup();
  return stepsBar(3) + titleBar(esc(whoLabel(G, ui.player)) + ' <small>· ' + whenText() + '</small>', 'back', '‹ Jugador') +
    groups + technicalGroup();
}

/** Falta recibida: ¿fue en tiro? Sugiere 2 o 3 libres según la ubicación. */
function foulDrawnStep(G) {
  const three = suggestsThree(G, ui.pending);
  const opt = (kind, label, sub, isThree, cls = '') =>
    '<button class="abtn' + cls + (isThree === undefined ? '' : hintClass(three, isThree)) + '" data-a="fd-kind" data-s="' + kind + '">' + label + '<small>' + sub + '</small></button>';
  return stepsBar(3) + titleBar(esc(whoLabel(G, ui.player)) + ' · Falta recibida', 'back-action', '‹ Acciones') +
    '<p class="lead">¿Fue en situación de tiro?</p><div class="agroup"><div class="agrid">' +
    '<button class="abtn wide" data-a="fd-kind" data-s="none">No, sin tiro</button>' +
    opt('shot2', 'En tiro de 2', '2 libres', false) + opt('shot3', 'En tiro de 3', '3 libres', true) +
    opt('and1-2', 'Encestó el doble', 'doble + 1 libre', false, ' make') + opt('and1-3', 'Encestó el triple', 'triple + 1 libre', true, ' make') +
    '</div></div>';
}

function foulStep(G) {
  return stepsBar(3) + titleBar(esc(whoLabel(G, ui.player)) + ' · Falta personal', 'back-action', '‹ Acciones') +
    '<p class="lead">¿Fue en situación de tiro?</p><div class="agroup"><div class="agrid">' +
    '<button class="abtn foul wide" data-a="act" data-t="PF" data-s="none">No, sin tiro</button>' +
    '<button class="abtn foul" data-a="act" data-t="PF" data-s="shot2">Tiro de 2 errado<small>2 libres</small></button>' +
    '<button class="abtn foul" data-a="act" data-t="PF" data-s="shot3">Tiro de 3 errado<small>3 libres</small></button>' +
    '<button class="abtn foul wide" data-a="act" data-t="PF" data-s="and1">El rival encestó igual<small>gol + 1 libre</small></button>' +
    '<button class="abtn wide" data-a="act" data-t="PF" data-s="off">Falta ofensiva<small>cuenta también como pérdida</small></button></div></div>';
}

function turnoverStep(G) {
  return stepsBar(3) + titleBar(esc(whoLabel(G, ui.player)) + ' · Pérdida', 'back-action', '‹ Acciones') +
    '<div class="agrid">' + Object.keys(TURNOVER_KINDS).map((k) => '<button class="abtn" data-a="act" data-t="TOV" data-s="' + k + '">' + TURNOVER_KINDS[k] + '</button>').join('') + '</div>';
}

function freeThrowStep(G) {
  const f = ui.ft;
  const back = f.afterFoul ? titleBar(esc(whoLabel(G, ui.player)) + ' · Tiros libres <small>· falta registrada</small>', 'cancel', 'Sin libres')
    : titleBar(esc(whoLabel(G, ui.player)) + ' · Tiros libres', 'back-action', '‹ Acciones');
  return stepsBar(3) + back +
    '<h3>Cantidad</h3><div class="agrid three">' + [1, 2, 3].map((n) => '<button class="abtn' + (f.att === n ? ' sel' : '') + '" data-a="ft-att" data-n="' + n + '">' + n + ' libre' + (n > 1 ? 's' : '') + '</button>').join('') + '</div>' +
    '<h3>Resultado · tocá para registrar</h3><div class="agrid ftq">' + Array.from({ length: f.att + 1 }, (_, i) => f.att - i).map((made) =>
      '<button class="abtn ' + (made === f.att ? 'make' : made === 0 ? 'miss' : '') + '" data-a="ft-quick" data-m="' + made + '" aria-label="' + made + ' de ' + f.att + ' convertidos">' +
      '<span class="ftq-n">' + made + '/' + f.att + '</span><small>' + (made === f.att ? 'todos adentro' : made === 0 ? 'ninguno' : made + ' adentro') + '</small></button>').join('') + '</div>';
}

function staffStep(G) {
  const st = staffFouls(G), dis = st.out ? ' disabled' : '';
  return stepsBar(3) + titleBar('Cuerpo técnico · ' + periodShort(ui.pending.period) + ' ' + formatSeconds(ui.pending.t), 'cancel', 'Cancelar') +
    '<p class="lead">' + staffSummary(G) + (st.out ? ' · <strong style="color:var(--bad)">DT descalificado</strong>' : '') + '</p>' +
    '<div class="agrid"><button class="abtn tech" data-a="act-staff" data-w="coach" data-t="TF"' + dis + '>Técnica al DT<small>' + (st.out ? 'DT descalificado' : 'falta «C»') + '</small></button>' +
    '<button class="abtn tech" data-a="act-staff" data-w="bench" data-t="TF">Técnica a la banca<small>falta «B»</small></button>' +
    '<button class="abtn tech wide" data-a="act-staff" data-w="coach" data-t="DF"' + dis + '>Descalificante al DT</button>' +
    '<button class="abtn tech wide" data-a="act-staff" data-w="bench" data-t="DF">Descalificante a la banca</button></div>';
}

/** Tras un gol: ¿hubo asistencia? Muestra a los compañeros en cancha. */
function assistStep(G) {
  const a = ui.assistFor;
  const mates = G.onCourt.filter((id) => id !== a.scorer);
  const card = (id) => {
    const p = findPlayer(G, id);
    return '<button class="pcard" data-a="assist-pick" data-id="' + esc(id) + '"><span class="pnum">' + esc(p.num) + '</span><span class="pname">' + esc(shortName(p.name) || 'Jugador') + '</span></button>';
  };
  return stepsBar(3) + titleBar('Gol de ' + esc(whoLabel(G, a.scorer)) + ' · ¿Hubo asistencia?', 'assist-none', 'Sin asistencia') +
    '<div class="pgrid">' + mates.map(card).join('') + '</div>' +
    '<p class="lead" style="font-size:.82rem">Tocá la cancha para seguir con la próxima jugada.</p>';
}

/** Se eligió un jugador de la banca: ¿faltó cargar el cambio? */
function benchStep(G) {
  const inId = ui.benchPick, p = findPlayer(G, inId);
  const card = (id) => {
    const q = findPlayer(G, id);
    return '<button class="pcard" data-a="bench-sub" data-id="' + esc(id) + '"><span class="pnum">' + esc(q.num) + '</span><span class="pname">' + esc(shortName(q.name) || 'Jugador') + '</span>' + foulDots(G, id) + '</button>';
  };
  const room = G.onCourt.length < requiredOnCourt(G);
  return stepsBar(2) + titleBar(whenText(), 'bench-back', '‹ Jugador') +
    '<p class="lead"><strong>#' + esc(p.num) + ' ' + esc(p.name || '') + '</strong> está en la banca. ¿Nos olvidamos de registrar el cambio?</p>' +
    '<h3>Sí, entró por</h3><div class="pgrid">' + G.onCourt.map(card).join('') + '</div>' +
    (room ? '<div class="row"><button class="btn" data-a="bench-sub">Entró sin que salga nadie</button></div>' : '') +
    '<div class="row"><button class="btn ghost" data-a="bench-back">No, elegir otro jugador</button></div>';
}

const STEPS = {
  bench: benchStep,
  assist: assistStep,
  loc: locationStep,
  player: playerStep,
  action: actionStep,
  foul: foulStep,
  fdrawn: foulDrawnStep,
  tov: turnoverStep,
  ft: freeThrowStep,
  staff: staffStep
};

export function renderPanel() {
  const step = STEPS[ui.step];
  $('#panel').innerHTML = step ? step(currentGame()) : '';
  announceStep();
}
