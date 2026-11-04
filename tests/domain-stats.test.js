import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eventPoints, ourScore, opponentScore, pointsByPeriod, isGameOver, isEnded, playerStats, teamFouls, staffFouls,
  playerFoulTypes, teamTotals, requiredOnCourt, percent
} from '../public/src/domain/stats.js';
import { whoLabel, shortName, eventDetail, eventCategory } from '../public/src/domain/describe.js';
import { makeGame, ev } from './fixtures.js';

test('points and score', () => {
  assert.equal(eventPoints({ type: '2M' }), 2);
  assert.equal(eventPoints({ type: '3M' }), 3);
  assert.equal(eventPoints({ type: 'FT', made: 2 }), 2);
  assert.equal(eventPoints({ type: '3X' }), 0);
  const g = makeGame({ events: [ev('2M', 'p1'), ev('3M', 'p2', { period: 2 }), ev('FT', 'p1', { att: 2, made: 1 })], oppP: { 1: 4, 2: '3' } });
  assert.equal(ourScore(g), 6);
  assert.equal(opponentScore(g), 7);
  assert.deepEqual(pointsByPeriod(g), [{ p: 1, us: 3, them: 4 }, { p: 2, us: 3, them: 3 }, { p: 3, us: 0, them: 0 }, { p: 4, us: 0, them: 0 }]);
});

test('game over only after regulation without tie', () => {
  const g = makeGame({ period: 4, clock: { rem: 0, running: false, t0: 0 }, events: [ev('2M', 'p1')] });
  assert.equal(isGameOver(g), true);
  g.oppP = { 4: 2 };
  assert.equal(isGameOver(g), false); // empate: suplementario
  assert.equal(isEnded({ ...g, status: 'final' }), true);
  assert.equal(isGameOver(makeGame({ period: 3, clock: { rem: 0, running: false, t0: 0 }, events: [ev('2M', 'p1')] })), false);
});

test('player stats box line', () => {
  const g = makeGame({
    events: [ev('2M', 'p1'), ev('2X', 'p1'), ev('3M', 'p1'), ev('FT', 'p1', { att: 3, made: 2 }), ev('RO', 'p1'), ev('RD', 'p1'),
      ev('AST', 'p1'), ev('STL', 'p1'), ev('BLK', 'p1'), ev('TOV', 'p1', { sub: 'pase' }), ev('PF', 'p1', { sub: 'off' }), ev('FD', 'p1'), ev('2M', 'p2')]
  });
  const s = playerStats(g, 'p1');
  assert.equal(s.pts, 7);
  assert.deepEqual([s.m2, s.a2, s.m3, s.a3, s.ftm, s.fta], [1, 2, 1, 1, 2, 3]);
  assert.equal(s.tov, 2); // la falta ofensiva también es pérdida
  assert.equal(s.fouls, 1);
  assert.equal(s.out, false);
  assert.equal(s.outWhy, '');
});

test('exclusion rules', () => {
  const why = (events) => playerStats(makeGame({ events }), 'p1').outWhy;
  assert.equal(why([1, 2, 3, 4, 5].map(() => ev('PF', 'p1'))), '5 faltas');
  assert.equal(why([1, 2, 3, 4].map(() => ev('PF', 'p1'))), '');
  assert.equal(why([ev('DF', 'p1')]), 'Descalificado');
  assert.equal(why([ev('TF', 'p1'), ev('TF', 'p1')]), 'Descalificado (T/U)');
  assert.equal(why([ev('UF', 'p1'), ev('UF', 'p1')]), 'Descalificado (T/U)');
  assert.equal(why([ev('TF', 'p1'), ev('UF', 'p1')]), 'Descalificado (T/U)');
  assert.equal(why([ev('PF', 'p1'), ev('PF', 'p1'), ev('PF', 'p1'), ev('PF', 'p1'), ev('TF', 'p1')]), '5 faltas');
  assert.equal(playerStats(makeGame({ events: [ev('DF', 'p1')] }), 'p1').out, true);
});

test('team fouls: overtime counts as 4th quarter, staff excluded', () => {
  const g = makeGame({
    events: [ev('PF', 'p1', { period: 4 }), ev('TF', 'p2', { period: 5 }), ev('TF', 'coach', { period: 4 }), ev('RO', 'p1', { period: 4 }), ev('PF', 'p3', { period: 1 })]
  });
  assert.equal(teamFouls(g, 4), 2);
  assert.equal(teamFouls(g, 6), 2);
  assert.equal(teamFouls(g, 1), 1);
});

test('staff fouls and disqualification', () => {
  assert.deepEqual(staffFouls(makeGame({ events: [ev('TF', 'coach'), ev('TF', 'bench')] })), { c: 1, b: 1, d: 0, out: false });
  assert.equal(staffFouls(makeGame({ events: [ev('TF', 'coach'), ev('TF', 'coach')] })).out, true);
  assert.equal(staffFouls(makeGame({ events: [ev('TF', 'coach'), ev('TF', 'bench'), ev('TF', 'bench')] })).out, true);
  assert.equal(staffFouls(makeGame({ events: [ev('DF', 'bench')] })).out, true);
});

test('foul types in order, totals, required on court, percent', () => {
  const g = makeGame({ events: [ev('TF', 'p1', { period: 2, t: 100 }), ev('PF', 'p1', { period: 1, t: 50 }), ev('PF', 'p1', { period: 1, t: 500 })] });
  assert.deepEqual(playerFoulTypes(g, 'p1'), ['PF', 'PF', 'TF']);
  assert.equal(teamTotals(makeGame({ events: [ev('2M', 'p1'), ev('3M', 'p2')] })).pts, 5);
  const five = [1, 2, 3, 4, 5].map(() => ev('PF', 'p1')), five2 = [1, 2, 3, 4, 5].map(() => ev('PF', 'p2')), five3 = [1, 2, 3, 4, 5].map(() => ev('PF', 'p3'));
  assert.equal(requiredOnCourt(makeGame()), 5);
  assert.equal(requiredOnCourt(makeGame({ events: [...five, ...five2, ...five3] })), 4);
  assert.equal(percent(1, 3), '33%');
  assert.equal(percent(0, 0), '—');
});

test('describe: names and details', () => {
  const g = makeGame();
  assert.equal(shortName('Tomás Ferreyra'), 'Ferreyra');
  assert.equal(shortName('  '), '');
  assert.equal(whoLabel(g, 'p1'), '#4 Ferreyra');
  assert.equal(whoLabel(g, 'p1', true), '#4 Tomás Ferreyra');
  assert.equal(whoLabel(g, 'coach', true), 'DT · Raúl Benítez');
  assert.equal(whoLabel(g, 'bench'), 'Banca');
  assert.equal(whoLabel(g, 'nadie'), '—');
  assert.equal(eventDetail(g, { type: 'FT', made: 1, att: 2 }), '1 de 2');
  assert.equal(eventDetail(g, { type: 'TOV', sub: '24s' }), '24 segundos');
  assert.equal(eventDetail(g, { type: 'SUB', inn: ['p6'], out: ['p1'] }), 'Entra #6 Sosa · Sale #4 Ferreyra');
  assert.equal(eventCategory({ type: 'FT', made: 0 }), 'miss');
  assert.equal(eventCategory({ type: 'FT', made: 1 }), 'score');
  assert.equal(eventCategory({ type: 'UF' }), 'tech');
  assert.equal(eventCategory({ type: 'AST' }), '');
});
