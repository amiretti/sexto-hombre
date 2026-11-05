// Tablero: tanteador, reloj, faltas de equipo y puntos del rival.

import { esc } from '../../../shared/html.js';
import { DEFAULT_TEAM_COLOR, DEFAULT_OPPONENT_COLOR, safeColor } from '../../../shared/colors.js';
import { remainingMs, formatSeconds, periodShort, periodLong } from '../../../domain/clock.js';
import { ourScore, opponentScore, teamFouls, isEnded } from '../../../domain/stats.js';
import { $ } from '../../dom.js';
import { currentGame, ui } from '../../state.js';

/** Siglas para el tablero en pantallas chicas: iniciales si hay varias palabras, si no las 3 primeras letras. */
export function teamAbbr(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '—';
  const abbr = words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join('') : words[0].slice(0, 3);
  return abbr.toUpperCase();
}

/** Nombre completo (tablet y lectores de pantalla) + siglas visibles solo en celular. */
function teamName(name) {
  return '<span class="tfull">' + esc(name) + '</span><span class="tabbr" aria-hidden="true">' + esc(teamAbbr(name)) + '</span>';
}

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
  return '<div class="side ' + pos + '"><span class="score"><span class="digits">' + ourScore(G) + '</span></span><span class="tname"><span class="cbar" style="background:' + esc(safeColor(G.teamColor, DEFAULT_TEAM_COLOR)) + '"></span>' + teamName(G.team) + '</span>' +
    '<span class="sub">Faltas eq. <span class="tfdots' + (tf >= 4 ? ' pen' : '') + '" role="img" aria-label="' + tf + (tf === 1 ? ' falta' : ' faltas') + ' de equipo">' + foulDots(tf) + '</span>' + penaltyTag(tf) + '</span></div>';
}

function opponentButtons() {
  return [1, 2, 3].map((n) => '<button class="oppb" data-a="opp" data-d="' + n + '" aria-label="Sumar ' + n + ' punto' + (n > 1 ? 's' : '') + ' al rival">+' + n + '</button>').join('') +
    '<button class="oppb minus" data-a="opp" data-d="-1" aria-label="Restar un punto al rival">−</button>';
}

function theirSide(G, pos) {
  return '<div class="side ' + pos + '"><span class="tname"><span class="cbar" style="background:' + esc(safeColor(G.oppColor, DEFAULT_OPPONENT_COLOR)) + '"></span>' + teamName(G.opponent) + '</span><span class="score"><span class="digits">' + opponentScore(G) + '</span></span>' +
    '<span class="sub oppctl">' + opponentButtons() + '</span></div>';
}

/** Chip «el reloj estaba detenido»: se ofrece sincronizar con el tablero; se cierra solo. */
function syncChip() {
  if (!ui.clockNotice) return '';
  return '<div class="sync-chip" role="status"><span>Reloj estaba detenido</span><button data-a="sync-open">Sincronizar</button>' +
    '<button data-a="sync-dismiss" aria-label="Descartar aviso del reloj">×</button></div>';
}

function middle(G, r, ended) {
  const cls = ended ? 'ended' : G.clock.running ? 'running' : 'stopped';
  const state = ended ? 'partido terminado' : G.clock.running ? 'corriendo, tocá para pausar' : 'detenido, tocá para iniciar';
  const icon = ended ? '' : '<span class="clock-ico" aria-hidden="true">' + (G.clock.running ? '❚❚' : '▶') + '</span>';
  return '<div class="mid"><div class="per">' + (ended ? 'Final del partido' : periodLong(G.period)) + '</div><button id="clock" class="clock ' + cls + '" data-a="clock">' +
    icon + '<span class="clock-time">' + formatSeconds(r / 1000) + '</span><span class="visually-hidden"> · reloj ' + state + '</span></button>' +
    '<div class="clock-ctl">' + clockControls(G, r, ended) + '</div>' + syncChip() + '</div>';
}

export function renderBoard() {
  const G = currentGame(), r = remainingMs(G.clock), ended = isEnded(G);
  const away = G.venue === 'away';
  $('#board').innerHTML = (away ? theirSide(G, 'home') : ourSide(G, 'home')) + middle(G, r, ended) + (away ? ourSide(G, 'away') : theirSide(G, 'away')) +
    // En celular los botones del rival van en una fila propia (en tablet se ocultan: están junto a su tanteador).
    '<div class="oppbar" role="group" aria-label="Puntos de ' + esc(G.opponent) + '"><span>' + esc(teamAbbr(G.opponent)) + '</span>' + opponentButtons() + '</div>';
  // Título de la pantalla y de la pestaña con el tanteador.
  const score = G.team + ' ' + ourScore(G) + ' – ' + opponentScore(G) + ' ' + G.opponent;
  const h1 = $('#game-title');
  if (h1) h1.textContent = 'Partido: ' + score;
  document.title = 'Partido · ' + score + ' · Sexto Hombre';
}

/** Actualiza solo los números del reloj (cada tick). */
export function tickClockDisplay() {
  const el = $('#clock');
  const G = currentGame();
  if (!el || !G) return;
  const t = el.querySelector('.clock-time');
  if (t) t.textContent = formatSeconds(remainingMs(G.clock) / 1000);
}
