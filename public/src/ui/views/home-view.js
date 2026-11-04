// «Mis partidos»: planteles y lista de partidos.

import { esc } from '../../shared/html.js';
import { formatDate } from '../../shared/ids.js';
import { DEFAULT_TEAM_COLOR, DEFAULT_OPPONENT_COLOR, safeColor } from '../../shared/colors.js';
import { state, ui, isDemo } from '../state.js';
import { TOAST_HTML } from '../toast.js';
import { brandLine } from '../components/brand.js';
import { teamCardHTML } from '../components/team-card.js';

function statusChip(game) {
  return game.status === 'final' ? '<span class="chip">Final</span>' : '<span class="chip live">En juego</span>';
}

/** Lado del marcador: barra de color, nombre y puntos. `right` invierte el orden. */
function sideHTML(name, color, score, right) {
  return right
    ? '<b class="num">' + score + '</b> ' + esc(name) + '<span class="cbar r" style="background:' + esc(color) + '"></span>'
    : '<span class="cbar" style="background:' + esc(color) + '"></span>' + esc(name) + ' <b class="num">' + score + '</b>';
}

function gameItemHTML(game) {
  const sm = game.summary || { us: 0, them: 0 }, armed = ui.confirm === 'gdel-' + game.id;
  const us = [game.team, safeColor(game.teamColor, DEFAULT_TEAM_COLOR), Number(sm.us) || 0];
  const them = [game.opponent, safeColor(game.oppColor, DEFAULT_OPPONENT_COLOR), Number(sm.them) || 0];
  const [left, right] = game.venue === 'away' ? [them, us] : [us, them];
  return '<li class="gitem"><button class="gopen" data-a="open-game" data-id="' + esc(game.id) + '">' +
    '<span class="gmeta">' + esc(formatDate(game.date)) + (game.competition ? ' · ' + esc(game.competition) : '') + '</span>' +
    '<span class="gteams">' + sideHTML(...left, false) + '<span class="gsep">–</span>' + sideHTML(...right, true) + '</span>' +
    '<span class="gstate">' + statusChip(game) + '<span class="gcta">' + (game.status === 'final' ? 'Ver ›' : 'Continuar ›') + '</span></span></button>' +
    // Borrar queda chico y apartado, y pide confirmación (segundo toque).
    '<button class="gdel' + (armed ? ' armed' : '') + '" data-a="del-game" data-id="' + esc(game.id) + '" aria-label="' + esc((armed ? 'Confirmar: borrar el partido ' : 'Borrar el partido ') + game.team + ' vs ' + game.opponent) + '">' + (armed ? '¿Borrar? Tocá de nuevo' : '🗑') + '</button></li>';
}

function gamesListHTML() {
  const list = state.games;
  if (list === null) return '<p class="lead">Cargando partidos…</p>';
  if (!list.length) {
    return '<div class="card empty-home"><h2>Todavía no cargaste partidos</h2><p class="lead">Creá el primero: elegís el rival, los convocados y el quinteto inicial, y arrancás.</p></div>';
  }
  return '<ul class="glist">' + list.map(gameItemHTML).join('') + '</ul>';
}

function teamsSectionHTML() {
  const teams = state.teams;
  if (teams === null) return '';
  if (!teams.length) {
    return '<section class="card empty-home"><h2>Mi plantel</h2><p class="lead">Cargá a tus jugadores una sola vez. En cada partido solo vas a elegir el rival, los convocados y el quinteto.</p>' +
      '<div class="row"><button class="btn" data-a="edit-team">+ Cargar plantel</button></div></section>';
  }
  return '<section class="tsec"><div class="roster-head"><h2>' + (teams.length === 1 ? 'Mi plantel' : 'Mis planteles') + '</h2><button class="btn ghost" data-a="new-team">+ Otro plantel</button></div><div class="tpick">' +
    teams.map((t) => teamCardHTML(t, 'edit-team', '<span class="tgo">Editar ›</span>')).join('') + '</div></section>';
}

function userHTML(u) {
  return '<div class="user">' + (u.photo ? '<img src="' + esc(u.photo) + '" alt="" referrerpolicy="no-referrer">' : '') + '<span>' + esc(u.name) + '</span>' +
    (isDemo() ? '' : '<button class="btn ghost" data-a="logout">Salir</button>') + '</div>';
}

export function homeHTML() {
  return '<div class="setup home">' +
    '<header class="setup-head"><div>' + brandLine() + '<h1>Mis partidos</h1></div>' + userHTML(state.user) + '</header>' +
    (isDemo() ? '<p class="note">Modo demo: los datos quedan solo en este dispositivo. Configurá Firebase para guardar en la nube con tu cuenta de Google.</p>' : '') +
    (state.gamesErr ? '<p class="err">' + esc(state.gamesErr) + '</p>' : '') +
    '<div class="row"><button class="btn primary big" data-a="new-setup"' + (state.teams === null ? ' disabled' : '') + '>+ Nuevo partido</button></div>' +
    teamsSectionHTML() + '<h2 class="hsec">Partidos</h2>' + gamesListHTML() + TOAST_HTML + '</div>';
}
