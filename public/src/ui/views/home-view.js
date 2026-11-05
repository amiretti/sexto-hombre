// «Mis partidos»: planteles y lista de partidos.

import { esc, plural } from '../../shared/html.js';
import { venuesOf } from '../../domain/club.js';
import { themeSwitchHTML } from '../components/theme-switch.js';
import { formatDate } from '../../shared/ids.js';
import { DEFAULT_TEAM_COLOR, DEFAULT_OPPONENT_COLOR, safeColor } from '../../shared/colors.js';
import { state, ui, isDemo } from '../state.js';
import { TOAST_HTML } from '../toast.js';
import { brandLine } from '../components/brand.js';
import { teamCardHTML } from '../components/team-card.js';
import { teamsOfClub, competitionsList } from '../selectors.js';

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
    '<span class="gmeta">' + esc(formatDate(game.date)) + (game.category ? ' · ' + esc(game.category) : '') + (game.competition ? ' · ' + esc(game.competition) : '') + (game.stadium && game.stadium.name ? ' · ' + esc(game.stadium.name) : '') + '</span>' +
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

function clubBlockHTML(c) {
  const teams = teamsOfClub(c.id), venues = venuesOf(c).length;
  const kit = '<span class="kit" aria-hidden="true"><span style="background:' + esc(safeColor(c.color, DEFAULT_TEAM_COLOR)) + '"></span><span style="background:' + esc(safeColor(c.altColor, '#ffffff')) + '"></span></span>';
  return '<div class="club"><div class="club-head">' + kit + '<h3>' + esc(c.name) + '</h3>' +
    '<span class="lead">' + (venues ? venues + ' ' + plural(venues, 'estadio') : 'Sin estadios') + '</span>' +
    '<button class="btn ghost" data-a="edit-club" data-id="' + esc(c.id) + '" aria-label="' + esc('Editar club ' + c.name) + '">Editar club</button></div>' +
    '<div class="tpick">' + teams.map((t) => teamCardHTML(t, 'edit-team', '<span class="tgo">Editar ›</span>', true)).join('') +
    '<button class="tcard add" data-a="new-team" data-id="' + esc(c.id) + '" aria-label="' + esc('Nuevo plantel de ' + c.name) + '">+ Plantel</button></div></div>';
}

function clubsSectionHTML() {
  const clubs = state.clubs;
  if (clubs === null || state.teams === null) return '';
  if (!clubs.length) {
    return '<section class="card empty-home"><h2>Mi club</h2><p class="lead">Cargá tu club (nombre, colores y estadios) y sus planteles una sola vez. En cada partido solo vas a elegir el rival, los convocados y el quinteto.</p>' +
      '<div class="row"><button class="btn" data-a="new-club">+ Cargar club</button></div></section>';
  }
  return '<section class="tsec"><div class="roster-head"><h2>' + (clubs.length === 1 ? 'Mi club' : 'Mis clubes') + '</h2><button class="btn ghost" data-a="new-club">+ Otro club</button></div>' +
    clubs.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'es')).map(clubBlockHTML).join('') + '</section>';
}

function competitionsSectionHTML() {
  if (state.competitions === null || !(state.clubs || []).length) return '';
  const list = competitionsList();
  const cards = list.map((c) => '<button class="tcard" data-a="edit-competition" data-id="' + esc(c.id) + '"><span class="tinfo"><b>' + esc(c.name) + '</b><span>' +
    esc([c.season, 'cuartos de ' + (c.periodMin || '10') + ' min'].filter(Boolean).join(' · ')) + '</span></span><span class="tgo">Editar ›</span></button>').join('');
  return '<section class="tsec"><div class="roster-head"><h2>Competiciones</h2><button class="btn ghost" data-a="new-competition">+ Competición</button></div>' +
    (list.length ? '<div class="tpick">' + cards + '</div>' : '<p class="lead">Cargá las ligas o torneos que jugás: se eligen al crear cada partido y proponen la duración del cuarto.</p>') + '</section>';
}

function userHTML(u) {
  return '<div class="user">' + (u.photo ? '<img src="' + esc(u.photo) + '" alt="" referrerpolicy="no-referrer">' : '') + '<span>' + esc(u.name) + '</span>' +
    themeSwitchHTML() +
    (isDemo() ? '' : '<button class="btn ghost" data-a="logout">Salir</button>') + '</div>';
}

export function homeHTML() {
  return '<div class="setup home">' +
    '<header class="setup-head"><div>' + brandLine() + '<h1>Mis partidos</h1></div>' + userHTML(state.user) + '</header>' +
    (isDemo() ? '<p class="note">Modo demo: los datos quedan solo en este dispositivo. Configurá Firebase para guardar en la nube con tu cuenta de Google.</p>' : '') +
    (state.gamesErr ? '<p class="err">' + esc(state.gamesErr) + '</p>' : '') +
    '<div class="row"><button class="btn primary big" data-a="new-setup"' + (state.teams === null || state.clubs === null ? ' disabled' : '') + '>+ Nuevo partido</button></div>' +
    clubsSectionHTML() + competitionsSectionHTML() + '<h2 class="hsec">Partidos</h2>' + gamesListHTML() + TOAST_HTML + '</div>';
}
