// Panel lateral: los pasos para cargar una jugada (ubicación → jugador → acción).

import { esc } from '../../../shared/html.js';
import { EVENT_LABELS, TURNOVER_KINDS } from '../../../domain/catalog.js';
import { periodShort, formatSeconds } from '../../../domain/clock.js';
import { isThreePointer, zoneName } from '../../../domain/court.js';
import { playerStats, playerFoulTypes, staffFouls, eventPoints } from '../../../domain/stats.js';
import { findPlayer, shortName, whoLabel, eventDetail } from '../../../domain/describe.js';
import { $ } from '../../dom.js';
import { ui, currentGame } from '../../state.js';

const STEP_NAMES = ['Ubicación', 'Jugador', 'Acción'];

function stepsBar(n) {
  return '<div class="steps">' + STEP_NAMES.map((x, i) => '<span class="' + (i + 1 === n ? 'on' : i + 1 < n ? 'done' : '') + '">' + (i + 1) + ' · ' + x + '</span>').join('') + '</div>';
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
  let h = '<span class="fd" aria-label="' + list.length + ' faltas">';
  for (let i = 0; i < Math.max(5, list.length); i++) {
    const t = list[i];
    h += '<i class="' + (t ? 'on' + (t !== 'PF' ? ' t' : '') : '') + '"></i>';
  }
  return h + '</span>';
}

function playerCard(G, id) {
  const p = findPlayer(G, id), s = playerStats(G, id);
  return '<button class="pcard' + (s.out ? ' out' : '') + '" data-a="pick" data-id="' + id + '"' + (s.out ? ' disabled' : '') + '><span class="pnum">' + esc(p.num) + '</span><span class="pname">' + esc(shortName(p.name) || 'Jugador') + '</span>' +
    foulDots(G, id) + (s.out ? '<span class="outtag">' + (s.fouls >= 5 && s.outWhy === '5 faltas' ? '5 faltas' : 'Descalif.') + '</span>' : '') + '</button>';
}

function actionButton(type, label) {
  return '<button class="abtn" data-a="act" data-t="' + type + '">' + label + '</button>';
}

function recentRow(G, e) {
  const d = eventDetail(G, e), pts = eventPoints(e);
  return '<li><span class="t">' + periodShort(e.period) + ' ' + formatSeconds(e.t) + '</span><span class="who">' + esc(whoLabel(G, e.who)) + '</span><span class="what">' + esc(EVENT_LABELS[e.type]) + (d ? ' · ' + esc(d) : '') + '</span>' +
    (pts ? '<span class="pts">+' + pts + '</span>' : '<span></span>') + '</li>';
}

function locationStep(G) {
  const rec = G.events.slice(-5).reverse();
  return stepsBar(1) + '<p class="lead">Tocá la cancha donde fue la jugada. El tiempo se toma en ese momento.</p>' +
    '<div class="quick"><button class="abtn" data-a="noloc">Sin ubicación<small>libres, técnicas</small></button><button class="abtn tech" data-a="staff">Técnica DT / banca<small>' + staffSummary(G) + '</small></button></div>' +
    '<div class="ptitle"><h3>Últimas jugadas</h3>' + (rec.length ? '<button class="btn ghost" data-a="undo">Deshacer última</button>' : '') + '</div>' +
    (rec.length ? '<ul class="recent">' + rec.map((e) => recentRow(G, e)).join('') + '</ul>' : '<p class="empty">Todavía no hay jugadas. Arrancá el reloj tocándolo y marcá la primera en la cancha.</p>');
}

function playerStep(G) {
  const bench = G.roster.filter((p) => !G.onCourt.includes(p.id)).map((p) => p.id);
  return stepsBar(2) + titleBar(whenText(), 'cancel', 'Cancelar') +
    '<h3>En cancha</h3><div class="pgrid">' + G.onCourt.map((id) => playerCard(G, id)).join('') + '</div>' +
    (bench.length ? '<h3>Banca</h3><div class="pgrid bench">' + bench.map((id) => playerCard(G, id)).join('') + '</div>' : '') +
    '<p class="lead" style="font-size:.82rem">¿Ubicación equivocada? Tocá de nuevo la cancha para moverla.</p>';
}

function actionStep(G) {
  const p = ui.pending, three = p.x != null ? isThreePointer(p.x, p.y) : null;
  const shot = (t, label, cls, isThree) => {
    const hint = three === null ? '' : (isThree === three ? ' sugg' : ' dim');
    return '<button class="abtn ' + cls + hint + '" data-a="act" data-t="' + t + '">' + label + '</button>';
  };
  return stepsBar(3) + titleBar(esc(whoLabel(G, ui.player)) + ' <small>· ' + whenText() + '</small>', 'back', '‹ Jugador') +
    '<div class="agroup"><h3>Lanzamientos</h3><div class="agrid">' +
      shot('2M', 'Doble<small>convertido</small>', 'make', false) + shot('2X', 'Doble<small>errado</small>', 'miss', false) +
      shot('3M', 'Triple<small>convertido</small>', 'make', true) + shot('3X', 'Triple<small>errado</small>', 'miss', true) +
      '<button class="abtn wide" data-a="ft">Tiros libres</button></div></div>' +
    '<div class="agroup"><h3>Juego</h3><div class="agrid three">' +
      actionButton('RO', 'Rebote<small>ofensivo</small>') + actionButton('RD', 'Rebote<small>defensivo</small>') + actionButton('AST', 'Asistencia') +
      actionButton('STL', 'Robo') + actionButton('BLK', 'Tapón') + '<button class="abtn" data-a="act" data-t="TOV" data-s="pasos">Pasos<small>caminata</small></button>' +
      '<button class="abtn wide" data-a="tov">Pérdida…<small>mal pase, doble, 3 seg, 24 seg, campo atrás</small></button></div></div>' +
    '<div class="agroup"><h3>Faltas</h3><div class="agrid">' +
      '<button class="abtn foul" data-a="foul">Falta personal<small>cometida</small></button>' + actionButton('FD', 'Falta recibida') +
      '<button class="abtn tech" data-a="act" data-t="TF">Técnica</button><button class="abtn tech" data-a="act" data-t="UF">Antideportiva</button>' +
      '<button class="abtn tech wide" data-a="act" data-t="DF">Descalificante</button></div></div>';
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
  return stepsBar(3) + titleBar(esc(whoLabel(G, ui.player)) + ' · Tiros libres', 'back-action', '‹ Acciones') +
    '<h3>Cantidad</h3><div class="agrid three">' + [1, 2, 3].map((n) => '<button class="abtn' + (f.att === n ? ' sel' : '') + '" data-a="ft-att" data-n="' + n + '">' + n + ' libre' + (n > 1 ? 's' : '') + '</button>').join('') + '</div>' +
    '<h3>Resultado</h3>' + f.res.map((r, i) => '<div class="ftrow"><b>' + (i + 1) + '°</b><button class="abtn make' + (r === 'm' ? ' sel' : '') + '" data-a="ft-res" data-i="' + i + '" data-v="m">Convertido</button><button class="abtn miss' + (r === 'x' ? ' sel' : '') + '" data-a="ft-res" data-i="' + i + '" data-v="x">Errado</button></div>').join('') +
    '<button class="btn primary big" data-a="ft-save"' + (f.res.includes(null) ? ' disabled' : '') + '>Registrar libres</button>';
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

const STEPS = {
  loc: locationStep,
  player: playerStep,
  action: actionStep,
  foul: foulStep,
  tov: turnoverStep,
  ft: freeThrowStep,
  staff: staffStep
};

export function renderPanel() {
  const step = STEPS[ui.step];
  $('#panel').innerHTML = step ? step(currentGame()) : '';
}
