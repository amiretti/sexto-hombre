import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ev } from './fixtures.js';
import { blankSetup, applyTeamToSetup, createGame } from '../public/src/domain/game-setup.js';
import { BASIC_ACTIONS, SHEET_KINDS, isBasicSheet, normalizeSubtype, subtypeLabel } from '../public/src/domain/catalog.js';
import { captureMoment } from '../public/src/domain/game.js';
import { playerStats, teamFouls, opponentTeamFouls } from '../public/src/domain/stats.js';
import { buildShotChart } from '../public/src/domain/shot-chart.js';
import { createGameSession } from '../public/src/application/game-session.js';
import { buildGameReport } from '../public/src/application/game-report.js';

const store = { saveGame: () => Promise.resolve(), putEvent: () => Promise.resolve(), deleteEvent: () => Promise.resolve() };
const team = { id: 't', name: 'X', players: Array.from({ length: 5 }, (_, i) => ({ id: 'p' + i, num: String(i + 4), name: 'J' + i })) };
const setupFor = (extra = {}) => ({ ...blankSetup(), opponent: 'Rival', sel: Object.fromEntries(team.players.map((p) => [p.id, { in: true, starter: true }])), ...extra });

test('el tipo de planilla se elige en la previa; por defecto y en partidos viejos es la avanzada', () => {
  assert.deepEqual(Object.keys(SHEET_KINDS), ['full', 'basic']);
  assert.equal(blankSetup().sheet, 'full');
  assert.equal(createGame(setupFor(), team).game.sheet, 'full');
  assert.equal(createGame(setupFor({ sheet: 'basic' }), team).game.sheet, 'basic');
  assert.equal(createGame(setupFor({ sheet: 'cualquiera' }), team).game.sheet, 'full');
  assert.equal(isBasicSheet(makeGame()), false); // sin `sheet`
  assert.equal(isBasicSheet(makeGame({ sheet: 'basic' })), true);
});

test('la previa propone el tipo de planilla que usó el plantel la última vez', () => {
  const s = blankSetup();
  applyTeamToSetup(s, { ...team, lastSheet: 'basic' });
  assert.equal(s.sheet, 'basic');
  applyTeamToSetup(s, team);
  assert.equal(s.sheet, 'full');
});

test('la botonera registra las mismas jugadas, sin ubicación', () => {
  const g = makeGame({ sheet: 'basic' });
  const s = createGameSession({ store, onSaveError: (e) => { throw e; } });
  s.open(g);
  const play = (key, who) => s.recordPlay(captureMoment(g), { ...BASIC_ACTIONS[key].action, who });
  ['1M', '1X', '2M', '2X', '3M', '3X', 'RO', 'RD', 'BLK', 'STL', 'TOV', 'PF'].forEach((k) => assert.ok(!play(k, 'p1').error, k));
  const st = playerStats(g, 'p1');
  assert.deepEqual([st.pts, st.ftm, st.fta, st.m2, st.a2, st.m3, st.a3], [6, 1, 2, 1, 2, 1, 2]);
  assert.deepEqual([st.ro, st.rd, st.blk, st.stl, st.tov, st.fouls], [1, 1, 1, 1, 1, 1]);
  assert.equal(teamFouls(g, 1), 1);
  assert.ok(g.events.every((e) => e.x === null && e.y === null));
  assert.equal(BASIC_ACTIONS.FD.action, null); // pregunta antes los libres
});

test('pérdida y falta de la botonera: «Sin detalle», no inventan un tipo', () => {
  assert.equal(normalizeSubtype('TOV', 'gen'), 'gen');
  assert.equal(normalizeSubtype('PF', 'gen'), 'gen');
  assert.equal(subtypeLabel('TOV', 'gen'), 'Sin detalle');
  assert.equal(subtypeLabel('PF', 'gen'), 'Sin detalle');
});

test('falta recibida con 1 libre (encestó igual) no registra un gol de más', () => {
  const g = makeGame({ sheet: 'basic', events: [ev('FD', 'p1', { sub: 'and1' }), ev('FD', 'p2', { sub: 'none' })] });
  assert.equal(playerStats(g, 'p1').fd, 1);
  assert.equal(playerStats(g, 'p1').pts, 0);
  assert.equal(opponentTeamFouls(g, 1), 2);
});

test('los partidos con planilla básica no entran en el mapa de tiros ni llevan su página en el PDF', () => {
  const shot = ev('2M', 'p1', { x: 400, y: 750 });
  const full = makeGame({ events: [shot] });
  const basic = makeGame({ id: 'g2', sheet: 'basic', events: [ev('2M', 'p1'), ev('3X', 'p1')] });
  const c = buildShotChart([full, basic]);
  assert.equal(c.total.att, 1);
  assert.equal(c.unlocated, 0);
  const r = buildGameReport(basic);
  assert.equal(r.basic, true);
  assert.equal(r.shotChart, null);
  assert.equal(r.totals.pts, 2);
  assert.notEqual(buildGameReport(full).shotChart, null);
});
