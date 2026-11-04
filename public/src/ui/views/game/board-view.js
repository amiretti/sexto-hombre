// Tablero: tanteador, reloj, faltas de equipo y puntos del rival.

import { esc } from '../../../shared/html.js';
import { DEFAULT_TEAM_COLOR, DEFAULT_OPPONENT_COLOR, safeColor } from '../../../shared/colors.js';
import { remainingMs, formatSeconds, periodShort, periodLong } from '../../../domain/clock.js';
import { ourScore, opponentScore, teamFouls, isEnded } from '../../../domain/stats.js';
import { $ } from '../../dom.js';
import { currentGame } from '../../state.js';

function foulDots(tf) {
  let dots = '';
  for (let i = 1; i <= 5; i++) dots += '<i class="' + (i <= tf ? 'on' : '') + '"></i>';
  return dots;
}

function penaltyTag(tf) {
  if (tf >= 5) return '<span class="pen-tag">Penalización</span>';
  if (tf === 4) return '<span class="pen-tag">Próxima: libres</span>';
  return '';
}

function clockControls(G, r, ended) {
  if (ended) return '<span class="final">Final</span><button data-a="clock-edit">Ajustar</button>';
  if (r <= 0 && !G.clock.running) return '<button class="go" data-a="next-period">Pasar a ' + periodShort(G.period + 1) + ' ›</button><button data-a="clock-edit">Ajustar</button>';
  return '<button data-a="adj" data-d="-1" aria-label="Restar un segundo">−1s</button><button data-a="adj" data-d="1" aria-label="Sumar un segundo">+1s</button><button data-a="clock-edit">Ajustar</button>';
}

function ourSide(G, pos) {
  const tf = teamFouls(G, G.period);
  return '<div class="side ' + pos + '"><span class="score">' + ourScore(G) + '</span><span class="tname"><span class="cbar" style="background:' + esc(safeColor(G.teamColor, DEFAULT_TEAM_COLOR)) + '"></span>' + esc(G.team) + '</span>' +
    '<span class="sub">Faltas eq. <span class="tfdots' + (tf >= 4 ? ' pen' : '') + '">' + foulDots(tf) + '</span>' + penaltyTag(tf) + '</span></div>';
}

function theirSide(G, pos) {
  return '<div class="side ' + pos + '"><span class="tname"><span class="cbar" style="background:' + esc(safeColor(G.oppColor, DEFAULT_OPPONENT_COLOR)) + '"></span>' + esc(G.opponent) + '</span><span class="score">' + opponentScore(G) + '</span>' +
    '<span class="sub"><button class="oppb" data-a="opp" data-d="1">+1</button><button class="oppb" data-a="opp" data-d="2">+2</button><button class="oppb" data-a="opp" data-d="3">+3</button><button class="oppb" data-a="opp" data-d="-1" aria-label="Restar un punto al rival">−</button></span></div>';
}

function middle(G, r, ended) {
  const cls = ended ? 'ended' : G.clock.running ? 'running' : 'stopped';
  return '<div class="mid"><div class="per">' + (ended ? 'Final del partido' : periodLong(G.period)) + '</div><button id="clock" class="clock ' + cls + '" data-a="clock" aria-label="Iniciar o pausar el reloj">' + formatSeconds(r / 1000) + '</button>' +
    '<div class="clock-ctl">' + clockControls(G, r, ended) + '</div></div>';
}

export function renderBoard() {
  const G = currentGame(), r = remainingMs(G.clock), ended = isEnded(G);
  const away = G.venue === 'away';
  $('#board').innerHTML = (away ? theirSide(G, 'home') : ourSide(G, 'home')) + middle(G, r, ended) + (away ? ourSide(G, 'away') : theirSide(G, 'away'));
}

/** Actualiza solo los números del reloj (cada tick). */
export function tickClockDisplay() {
  const el = $('#clock');
  const G = currentGame();
  if (!el || !G) return;
  el.textContent = formatSeconds(remainingMs(G.clock) / 1000);
}
