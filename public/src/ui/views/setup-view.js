// Previa del partido: elección de plantel, datos del partido, convocados y quinteto.

import { esc, plural } from '../../shared/html.js';
import { DEFAULT_TEAM_COLOR, DEFAULT_OPPONENT_COLOR, colorsTooClose, safeColor } from '../../shared/colors.js';
import { activePlayers } from '../../domain/team.js';
import { venuesOf, teamLabel } from '../../domain/club.js';
import { calledPlayers, kitOf } from '../../domain/game-setup.js';
import { state, ui } from '../state.js';
import { TOAST_HTML } from '../toast.js';
import { teamById, resolvedTeams, competitionsList } from '../selectors.js';
import { textField, colorField, periodLengthField } from '../components/fields.js';
import { competitionLabel } from '../../domain/competition.js';
import { teamCardHTML } from '../components/team-card.js';

const HEADER = '<header class="setup-head"><div><p class="eyebrow"><button class="linkback" data-a="go-home">‹ Mis partidos</button></p><h1>Nuevo partido</h1></div></header>';

function teamPickerHTML() {
  const teams = resolvedTeams();
  return '<div class="setup">' + HEADER + '<section class="card"><h2>¿Con qué plantel jugás?</h2><div class="tpick">' +
    teams.map((t) => teamCardHTML(t, 'pick-team')).join('') + '</div></section>' + TOAST_HTML + '</div>';
}

/** Opción de un grupo segmentado (patrón radiogroup: solo la marcada entra en el orden de Tab; flechas para cambiar). */
function radio(action, value, checked, label) {
  return '<button role="radio" data-a="' + action + '" data-v="' + value + '" aria-checked="' + checked + '" tabindex="' + (checked ? 0 : -1) + '">' + label + '</button>';
}

function venueFieldHTML(venue) {
  return '<div class="field"><span class="flabel" id="venue-l">Jugamos de</span><div class="seg" role="radiogroup" aria-labelledby="venue-l">' +
    radio('venue', 'home', venue === 'home', 'Local') + radio('venue', 'away', venue === 'away', 'Visitante') + '</div></div>';
}

/** De local: en qué estadio se juega (elegible si el plantel tiene más de uno). */
function stadiumFieldHTML(s, t) {
  if (s.venue === 'away') return '';
  const venues = venuesOf(t);
  if (!venues.length) {
    return '<div class="field full"><span class="flabel">Estadio</span><p class="lead hint">Cargá los estadios del club para que quede registrado dónde se jugó. <button class="linkback small" data-a="edit-club" data-id="' + esc(t.clubId || '') + '">Editar club</button></p></div>';
  }
  if (venues.length === 1) {
    const v = venues[0];
    return '<div class="field full"><span class="flabel">Estadio</span><p class="vstatic"><b>' + esc(v.name) + '</b> <span>' + esc(v.location) + '</span></p></div>';
  }
  const chosen = venues.some((v) => v.id === s.venueId);
  return '<div class="field full"><span class="flabel" id="stadium-l">¿En qué estadio se juega?</span><div class="vpick" role="radiogroup" aria-labelledby="stadium-l" aria-required="true">' +
    venues.map((v, i) => {
      const on = v.id === s.venueId;
      return '<button role="radio" data-a="stadium" data-v="' + esc(v.id) + '" aria-checked="' + on + '" tabindex="' + (on || (!chosen && i === 0) ? 0 : -1) + '"><b>' + esc(v.name) + '</b><span>' + esc(v.location) + (v.id === t.defaultVenueId ? ' · por defecto' : '') + '</span></button>';
    }).join('') + '</div></div>';
}

/** Camiseta titular o alternativa del club (si tiene alternativa). */
function kitFieldHTML(s, t) {
  if (!t.altColor) return '';
  const kit = kitOf(s, t);
  const swatch = (c) => '<span class="kitsw" style="background:' + esc(safeColor(c, DEFAULT_TEAM_COLOR)) + '"></span>';
  return '<div class="field"><span class="flabel" id="kit-l">Camiseta</span><div class="vpick kitpick" role="radiogroup" aria-labelledby="kit-l">' +
    '<button role="radio" data-a="kit" data-v="main" aria-checked="' + (kit === 'main') + '" tabindex="' + (kit === 'alt' ? -1 : 0) + '">' + swatch(t.color) + '<b>Titular</b></button>' +
    '<button role="radio" data-a="kit" data-v="alt" aria-checked="' + (kit === 'alt') + '" tabindex="' + (kit === 'alt' ? 0 : -1) + '">' + swatch(t.altColor) + '<b>Alternativa</b></button></div></div>';
}

/** Aviso de colores parecidos; si la alternativa del club se distingue del rival, la ofrece. */
function clashChipHTML(s, t) {
  const opp = s.oppColor || DEFAULT_OPPONENT_COLOR;
  if (!colorsTooClose(s.teamColor || DEFAULT_TEAM_COLOR, opp)) return '';
  const alt = t.altColor && kitOf(s, t) !== 'alt' && !colorsTooClose(t.altColor, opp);
  return '<span class="chip warn">Los colores de los equipos son muy parecidos' + (alt ? ' <button class="linkback small" data-a="kit" data-v="alt">Usar la alternativa</button>' : '') + '</span>';
}

/** Competición del partido (o amistoso), con acceso a crear una nueva sin salir de la previa. */
function competitionFieldHTML(s) {
  const list = competitionsList();
  const options = '<option value="">Amistoso / sin competición</option>' +
    list.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === s.competitionId ? ' selected' : '') + '>' + esc(competitionLabel(c)) + '</option>').join('');
  return '<div class="field"><span class="flabel"><label for="f-comp">Competición</label><button class="linkback small" data-a="new-competition">+ Nueva</button></span>' +
    '<select id="f-comp" data-f="competitionId">' + options + '</select></div>';
}

function attackFieldHTML(attack) {
  return '<div class="field"><span class="flabel" id="attack-l">En el 1er tiempo atacamos hacia</span><div class="seg" role="radiogroup" aria-labelledby="attack-l">' +
    radio('attack', 'left', attack === 'left', '← Izquierda') + radio('attack', 'right', attack === 'right', 'Derecha →') + '</div></div>';
}

function matchCardHTML(s, t) {
  const teams = state.teams || [];
  const venue = s.venue === 'away' ? 'away' : 'home';
  return '<section class="card"><div class="roster-head"><h2>Partido</h2>' + clashChipHTML(s, t) + '</div><div class="setup-grid">' +
    colorField('f-team', 'Mi equipo', null, teamLabel(t), 'teamColor', s.teamColor || DEFAULT_TEAM_COLOR, 'de mi equipo', teams.length > 1 ? '<button class="linkback small" data-a="change-team">Cambiar plantel</button>' : '') + kitFieldHTML(s, t) +
    colorField('f-opp', 'Rival', 'opponent', s.opponent, 'oppColor', s.oppColor || DEFAULT_OPPONENT_COLOR, 'del rival') +
    venueFieldHTML(venue) + stadiumFieldHTML(s, t) + attackFieldHTML(s.attack === 'left' ? 'left' : 'right') +
    competitionFieldHTML(s) + textField('f-coach', 'Entrenador (DT)', 'coach', s.coach) +
    '<div class="field"><label for="f-date">Fecha</label><input id="f-date" type="date" data-f="date" value="' + esc(s.date) + '"></div>' + periodLengthField(s.periodMin) +
    '</div></section>';
}

function callRowHTML(p, sel) {
  const c = sel[p.id] || {}, on = !!c.in;
  return '<div class="crow' + (on ? '' : ' off') + '"><span class="cn">' + esc(p.num) + '</span><span class="cname">' + esc(p.name || '—') + '</span>' +
    '<button class="starter callb" data-a="call" data-id="' + esc(p.id) + '" aria-pressed="' + on + '" aria-label="' + esc('Convocado: #' + p.num + ' ' + (p.name || '')) + '">' + (on ? 'Convocado' : 'No va') + '</button>' +
    '<button class="starter" data-a="starter" data-id="' + esc(p.id) + '" aria-pressed="' + !!(on && c.starter) + '" aria-label="' + esc('Titular: #' + p.num + ' ' + (p.name || '')) + '"' + (on ? '' : ' disabled') + '>' + (on && c.starter ? 'Titular' : 'Suplente') + '</button></div>';
}

function rosterCardHTML(s, t) {
  const players = activePlayers(t), sel = s.sel || {};
  const called = calledPlayers(s, t), starters = called.filter((p) => sel[p.id].starter).length;
  return '<section class="card"><div class="roster-head"><h2>Convocados y quinteto</h2><span class="chips"><span class="chip' + (called.length > 12 ? ' warn' : '') + '">' + called.length + ' ' + plural(called.length, 'convocado') + '</span>' +
    '<span id="st-count" class="chip ' + (starters === 5 ? 'ok' : 'bad') + '">' + starters + ' de 5 titulares</span></span></div>' +
    (players.length ? '<div class="roster">' + players.map((p) => callRowHTML(p, sel)).join('') + '</div>' : '<p class="lead">Este plantel no tiene jugadores activos.</p>') +
    '<div class="row"><button class="btn" data-a="edit-team">Editar plantel</button><span class="lead hint">Tocá «Suplente» para pasarlo al quinteto. Si falta alguien, agregalo al plantel.</span></div>' +
    '</section>';
}

/** Pie fijo: siempre se ve cuántos titulares hay y el botón para empezar. */
function startFooterHTML(s, t) {
  const sel = s.sel || {}, starters = calledPlayers(s, t).filter((p) => sel[p.id].starter).length;
  return '<div class="setup-foot sticky"><p class="err" id="setup-err" role="alert">' + esc(ui.setupErr) + '</p>' +
    '<span class="chip ' + (starters === 5 ? 'ok' : 'bad') + '">' + starters + ' de 5 titulares</span>' +
    '<button class="btn primary big" data-a="start">Empezar partido</button></div>';
}

export function setupHTML() {
  const s = state.setup, t = teamById(s.teamId);
  if (!t) return teamPickerHTML();
  return '<div class="setup">' + HEADER + matchCardHTML(s, t) + rosterCardHTML(s, t) +
    startFooterHTML(s, t) + TOAST_HTML + '</div>';
}
