// Tarjeta de plantel (lista de «Mis planteles» y elección en la previa).

import { esc, plural } from '../../shared/html.js';
import { DEFAULT_TEAM_COLOR, safeColor } from '../../shared/colors.js';
import { activePlayers, categoryLabel } from '../../domain/team.js';
import { teamLabel } from '../../domain/club.js';

/** "12 jugadores · Liga…" (HTML escapado). */
export function teamMeta(team) {
  const n = activePlayers(team).length;
  return n + ' ' + plural(n, 'jugador', 'jugadores');
}

/**
 * @param {object} team
 * @param {string} action data-a del botón
 * @param {string} [trailing] HTML al final de la tarjeta
 * @param {boolean} [inClub] dentro de su club: el título es solo la categoría
 */
export function teamCardHTML(team, action, trailing = '', inClub = false) {
  const title = inClub ? (categoryLabel(team) || 'Sin categoría') : teamLabel(team);
  return '<button class="tcard" data-a="' + action + '" data-id="' + esc(team.id) + '"><span class="tsw" style="background:' + esc(safeColor(team.color, DEFAULT_TEAM_COLOR)) +
    '"></span><span class="tinfo"><b>' + esc(title) + '</b><span>' + teamMeta(team) + '</span></span>' + trailing + '</button>';
}
