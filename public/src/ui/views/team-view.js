// Edición de un plantel.

import { esc, plural } from '../../shared/html.js';
import { DEFAULT_TEAM_COLOR } from '../../shared/colors.js';
import { activePlayers, MAX_PLAYERS_PER_TEAM } from '../../domain/team.js';
import { state, ui } from '../state.js';
import { TOAST_HTML } from '../toast.js';
import { hasTeams } from '../selectors.js';
import { textField, colorField, competitionField, periodLengthField } from '../components/fields.js';

function playerRowHTML(p) {
  const on = p.active !== false;
  return '<div class="rrow' + (on ? '' : ' off') + '"><input class="n" inputmode="numeric" maxlength="2" aria-label="' + esc('Número de ' + (p.name || 'jugador nuevo')) + '" id="n-' + esc(p.id) + '" data-pid="' + esc(p.id) + '" data-pf="num" value="' + esc(p.num) + '">' +
    '<input aria-label="' + esc('Nombre del jugador ' + (p.num || 'nuevo')) + '" id="m-' + esc(p.id) + '" data-pid="' + esc(p.id) + '" data-pf="name" value="' + esc(p.name) + '" placeholder="Nombre y apellido">' +
    '<button class="starter" data-a="tp-active" data-id="' + esc(p.id) + '" aria-pressed="' + on + '" aria-label="' + esc('Activo: #' + (p.num || '') + ' ' + (p.name || '')) + '">' + (on ? 'Activo' : 'De baja') + '</button>' +
    (p.fresh ? '<button class="rm" data-a="tp-rm" data-id="' + esc(p.id) + '" aria-label="Quitar jugador">×</button>' : '<span></span>') + '</div>';
}

function headerHTML(t) {
  const back = ui.after === 'setup' && hasTeams() ? 'Volver al partido' : 'Mis partidos';
  const note = t.seeded === 'last' ? '<p class="note">Lo armamos con el plantel de tu último partido. Revisalo y guardalo.</p>'
    : t.seeded === 'example' ? '<p class="note">Cargamos un plantel de ejemplo. <button data-a="team-clear">Vaciar y cargar el mío</button></p>' : '';
  return '<header class="setup-head"><div><p class="eyebrow"><button class="linkback" data-a="team-cancel">‹ ' + back + '</button></p><h1>' +
    (t.isNew ? 'Nuevo plantel' : (esc(t.name) || 'Plantel')) + '</h1></div>' + note + '</header>';
}

function teamInfoCardHTML(t) {
  return '<section class="card"><h2>Equipo</h2><div class="setup-grid">' +
    colorField('f-tname', 'Nombre del equipo', 'name', t.name, 'color', t.color || DEFAULT_TEAM_COLOR, 'del equipo') + textField('f-coach', 'Entrenador (DT)', 'coach', t.coach) +
    competitionField(t.competition) + periodLengthField(t.periodMin) +
    '</div><p class="lead hint">El color, el DT, la competición y la duración se proponen en cada partido nuevo; ahí los podés cambiar.</p></section>';
}

function rosterCardHTML(t) {
  const active = activePlayers(t).length;
  return '<section class="card"><div class="roster-head"><h2>Jugadores</h2><span class="chip">' + active + ' ' + plural(active, 'activo') + '</span></div>' +
    '<div class="roster"><div class="rrow headrow"><span>Nº</span><span>Jugador</span><span>Estado</span><span></span></div>' + t.players.map(playerRowHTML).join('') + '</div>' +
    '<div class="row"><button class="btn" data-a="tp-add"' + (t.players.length >= MAX_PLAYERS_PER_TEAM ? ' disabled' : '') + '>+ Agregar jugador</button><span class="lead hint">Dar de baja a un jugador no cambia los partidos ya jugados.</span></div>' +
    '</section>';
}

function footerHTML(t) {
  const armed = ui.confirm === 'tdel';
  return '<div class="setup-foot">' + (t.isNew ? '' : '<button class="btn danger lft' + (armed ? ' armed' : '') + '" data-a="team-del">' + (armed ? '¿Borrar el plantel?' : 'Borrar plantel') + '</button>') +
    '<p class="err" id="setup-err" role="alert">' + esc(ui.setupErr) + '</p><button class="btn primary big" data-a="team-save">Guardar plantel</button></div>';
}

export function teamHTML() {
  const t = state.teamEdit;
  return '<div class="setup">' + headerHTML(t) + teamInfoCardHTML(t) + rosterCardHTML(t) + footerHTML(t) + TOAST_HTML + '</div>';
}
