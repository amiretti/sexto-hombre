// Inicio de la app, en secciones: resumen, partidos, club y competiciones (menú abajo en celular, pestañas arriba en tablet).

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
import { periodShort } from '../../domain/clock.js';
import { dashboardScope, scopeGames, liveGames, recentResults, seasonRecord, outcome } from '../../domain/dashboard.js';

/** Secciones del inicio, en el orden del menú. */
export const HOME_TABS = [
  { id: 'inicio', label: 'Inicio', title: 'Inicio', icon: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>' },
  { id: 'partidos', label: 'Partidos', title: 'Partidos', icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8"/>' },
  { id: 'club', label: 'Club', title: 'Mi club', icon: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/>' },
  { id: 'competiciones', label: 'Competiciones', title: 'Competiciones', icon: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6"/>' }
];

export const homeTab = () => (HOME_TABS.some((t) => t.id === state.homeTab) ? state.homeTab : 'inicio');

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
  return '<section class="tsec"><div class="roster-head"><h2 class="visually-hidden">' + (clubs.length === 1 ? 'Mi club' : 'Mis clubes') + '</h2><button class="btn ghost" data-a="new-club">+ Otro club</button></div>' +
    clubs.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'es')).map(clubBlockHTML).join('') + '</section>';
}

function competitionsSectionHTML() {
  if (state.competitions === null || !(state.clubs || []).length) return '';
  const list = competitionsList();
  const cards = list.map((c) => '<button class="tcard" data-a="edit-competition" data-id="' + esc(c.id) + '"><span class="tinfo"><b>' + esc(c.name) + '</b><span>' +
    esc([c.season, 'cuartos de ' + (c.periodMin || '10') + ' min'].filter(Boolean).join(' · ')) + '</span></span><span class="tgo">Editar ›</span></button>').join('');
  return '<section class="tsec"><div class="roster-head"><h2 class="visually-hidden">Competiciones</h2><button class="btn ghost" data-a="new-competition">+ Competición</button></div>' +
    (list.length ? '<div class="tpick">' + cards + '</div>' : '<p class="lead">Cargá las ligas o torneos que jugás: se eligen al crear cada partido y proponen la duración del cuarto.</p>') + '</section>';
}

function userHTML(u) {
  return '<div class="user">' + (u.photo ? '<img src="' + esc(u.photo) + '" alt="" referrerpolicy="no-referrer">' : '') + '<span class="uname">' + esc(u.name) + '</span>' +
    themeSwitchHTML() +
    (isDemo() ? '' : '<button class="btn ghost" data-a="logout">Salir</button>') + '</div>';
}

function navHTML(tab) {
  return '<nav class="hnav" aria-label="Secciones">' + HOME_TABS.map((t) =>
    '<button type="button" data-a="home-tab" data-v="' + t.id + '"' + (t.id === tab ? ' aria-current="page"' : '') + '>' +
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + t.icon + '</svg><span>' + t.label + '</span></button>').join('') + '</nav>';
}

function newGameButton() {
  return '<button class="btn primary big" data-a="new-setup"' + (state.teams === null || state.clubs === null ? ' disabled' : '') + '>+ Nuevo partido</button>';
}

/* ---------- Inicio (resumen) ---------- */

/** Tarjeta grande del partido en curso. */
function liveCardHTML(game) {
  const sm = game.summary || { us: 0, them: 0 };
  const us = [game.team, safeColor(game.teamColor, DEFAULT_TEAM_COLOR), Number(sm.us) || 0];
  const them = [game.opponent, safeColor(game.oppColor, DEFAULT_OPPONENT_COLOR), Number(sm.them) || 0];
  const [left, right] = game.venue === 'away' ? [them, us] : [us, them];
  const side = ([name, color, pts]) => '<span class="lside"><span class="lname"><span class="cbar" style="background:' + esc(color) + '"></span>' + esc(name) + '</span><b class="lpts">' + pts + '</b></span>';
  return '<button class="livecard" data-a="open-game" data-id="' + esc(game.id) + '">' +
    '<span class="lhead"><span class="chip live">En juego' + (game.period ? ' · ' + periodShort(game.period) : '') + '</span><span class="lmeta">' + esc([formatDate(game.date), game.competition].filter(Boolean).join(' · ')) + '</span></span>' +
    '<span class="lscore">' + side(left) + side(right) + '</span><span class="lcta">Continuar partido ›</span></button>';
}

const fmt = (n) => (n == null ? '—' : String(n).replace('.', ','));

function recordHTML(r) {
  const diff = r.ptsFor == null ? null : Math.round((r.ptsFor - r.ptsAgainst) * 10) / 10;
  const tile = (label, value, sub) => '<div class="stile"><span class="slabel">' + label + '</span><b class="svalue">' + value + '</b>' + (sub ? '<span class="ssub">' + sub + '</span>' : '') + '</div>';
  return '<div class="stiles">' +
    tile('Récord', r.won + '-' + r.lost + (r.tied ? '-' + r.tied : ''), r.played + ' ' + plural(r.played, 'partido') + ' · G-P') +
    tile('Puntos a favor', fmt(r.ptsFor), 'por partido') +
    tile('Puntos en contra', fmt(r.ptsAgainst), 'por partido') +
    tile('Diferencia', diff == null ? '—' : (diff > 0 ? '+' : '') + fmt(diff), 'por partido') + '</div>';
}

function resultRowHTML(game) {
  const sm = game.summary || {};
  const badge = { W: ['win', 'G', 'Ganado'], L: ['loss', 'P', 'Perdido'], T: ['tie', 'E', 'Empate'] }[outcome(game)];
  return '<li><button class="rrow" data-a="open-game" data-id="' + esc(game.id) + '"><span class="rbadge ' + badge[0] + '" title="' + badge[2] + '"><span aria-hidden="true">' + badge[1] + '</span><span class="visually-hidden">' + badge[2] + '</span></span>' +
    '<span class="ropp"><b>vs ' + esc(game.opponent) + '</b><small>' + esc([formatDate(game.date), game.competition].filter(Boolean).join(' · ')) + '</small></span>' +
    '<span class="rscore">' + (Number(sm.us) || 0) + ' – ' + (Number(sm.them) || 0) + '</span></button></li>';
}

function leadersHTML() {
  const d = state.dash;
  if (!d || d.leaders === null) return '<p class="lead">Calculando líderes…</p>';
  if (!d.leaders.some((c) => c.leaders.length)) return '<p class="lead">Los líderes aparecen cuando terminás el primer partido de la temporada.</p>';
  return '<div class="leaders">' + d.leaders.map((c) => '<div class="lcard"><h3>' + c.stat.label + ' <small>por partido</small></h3>' +
    (c.leaders.length ? '<ol>' + c.leaders.map((p, i) => '<li' + (i === 0 ? ' class="first"' : '') + '><span class="lnum">' + esc(p.num) + '</span><span class="lpl">' + esc(p.name || 'Jugador') + '<small>' + p.games + ' PJ · ' + p.total + ' en total</small></span><b>' + fmt(p.average) + '</b></li>').join('') + '</ol>' : '<p class="lead">Sin datos.</p>') +
    '</div>').join('') + '</div>';
}

function dashboardHTML() {
  if (state.clubs !== null && state.teams !== null && !state.clubs.length) return clubsSectionHTML();
  const games = state.games;
  const quick = '<div class="row">' + newGameButton() +
    ((games || []).length && (state.teams || []).length ? '<button class="btn big" data-a="open-reports">Informes</button>' : '') + '</div>';
  if (games === null) return quick + '<p class="lead">Cargando partidos…</p>';
  if (!games.some((g) => !g.deleted)) return quick + gamesListHTML();
  const scope = dashboardScope(games), inScope = scopeGames(games, scope);
  const live = liveGames(games), recent = recentResults(inScope, 5);
  const latest = inScope.reduce((a, g) => (String(g.date || '') >= String(a.date || '') ? g : a), {});
  const who = [latest.team, latest.category].filter(Boolean).join(' · ');
  return quick +
    (live.length ? '<section class="dsec"><h2 class="visually-hidden">Partido en curso</h2>' + live.slice(0, 2).map(liveCardHTML).join('') + '</section>' : '') +
    '<section class="dsec"><div class="dhead"><h2>Temporada ' + esc(scope.season || '') + '</h2>' + (who ? '<span class="lead">' + esc(who) + '</span>' : '') + '</div>' + recordHTML(seasonRecord(inScope)) + '</section>' +
    '<section class="dsec"><div class="dhead"><h2>Últimos resultados</h2>' + (recent.length ? '<button class="btn ghost" data-a="home-tab" data-v="partidos">Ver todos ›</button>' : '') + '</div>' +
    (recent.length ? '<ul class="rlist">' + recent.map(resultRowHTML).join('') + '</ul>' : '<p class="lead">Todavía no terminaste partidos esta temporada.</p>') + '</section>' +
    '<section class="dsec"><div class="dhead"><h2>Líderes del plantel</h2></div>' + leadersHTML() + '</section>';
}

function tabBodyHTML(tab) {
  if (tab === 'partidos') return '<div class="row">' + newGameButton() + '</div>' + gamesListHTML();
  if (tab === 'club') return clubsSectionHTML() || '<p class="lead">Cargando…</p>';
  if (tab === 'competiciones') return competitionsSectionHTML() || (state.clubs === null ? '<p class="lead">Cargando…</p>' : '<p class="lead">Primero cargá tu club en la sección Club.</p>');
  return dashboardHTML();
}

export function homeHTML() {
  const tab = homeTab(), t = HOME_TABS.find((x) => x.id === tab);
  return '<div class="setup home">' +
    '<header class="setup-head"><div>' + brandLine() + '<h1 id="home-h1" tabindex="-1">' + t.title + '</h1></div>' + userHTML(state.user) + '</header>' +
    navHTML(tab) +
    (isDemo() ? '<p class="note">Modo demo: los datos quedan solo en este dispositivo. Configurá Firebase para guardar en la nube con tu cuenta de Google.</p>' : '') +
    (state.gamesErr ? '<p class="err">' + esc(state.gamesErr) + '</p>' : '') +
    '<main class="hbody" id="home-body">' + tabBodyHTML(tab) + '</main>' + TOAST_HTML + '</div>';
}
