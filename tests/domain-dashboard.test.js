import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  outcome, dashboardScope, scopeGames, liveGames, recentResults, seasonRecord, seasonLeaders
} from '../public/src/domain/dashboard.js';

const g = (id, date, us, them, over = {}) => ({ id, teamId: 't1', date, status: 'final', summary: { us, them }, ...over });

test('outcome: win, loss, tie', () => {
  assert.equal(outcome(g('a', '2026-01-01', 70, 60)), 'W');
  assert.equal(outcome(g('a', '2026-01-01', 50, 60)), 'L');
  assert.equal(outcome(g('a', '2026-01-01', 60, 60)), 'T');
});

test('scope: team and season of the latest game, without deleted ones', () => {
  const games = [g('a', '2025-12-01', 1, 0, { teamId: 'old' }), g('b', '2026-03-01', 1, 0), g('c', '2026-05-01', 1, 0, { teamId: 'x', deleted: true })];
  const scope = dashboardScope(games);
  assert.deepEqual(scope, { teamId: 't1', season: '2026' });
  assert.deepEqual(scopeGames(games, scope).map((x) => x.id), ['b']);
  assert.equal(dashboardScope([]), null);
});

test('live games and recent results, newest first', () => {
  const games = [g('a', '2026-01-01', 1, 0), g('b', '2026-02-01', 0, 1), g('c', '2026-03-01', 0, 0, { status: 'live' }), g('d', '2026-04-01', 2, 1, { deleted: true })];
  assert.deepEqual(liveGames(games).map((x) => x.id), ['c']);
  assert.deepEqual(recentResults(games, 5).map((x) => x.id), ['b', 'a']);
  assert.deepEqual(recentResults(games, 1).map((x) => x.id), ['b']);
});

test('season record counts only finished games', () => {
  const r = seasonRecord([g('a', '2026-01-01', 70, 60), g('b', '2026-01-02', 50, 61), g('c', '2026-01-03', 10, 0, { status: 'live' })]);
  assert.deepEqual(r, { played: 2, won: 1, lost: 1, tied: 0, ptsFor: 60, ptsAgainst: 60.5 });
  assert.equal(seasonRecord([]).ptsFor, null);
});

test('leaders by average over the games each player was called up', () => {
  const roster = [{ id: 'a', num: '4', name: 'Ana' }, { id: 'b', num: '7', name: 'Bea' }];
  const games = [
    { id: 'g1', date: '2026-01-01', roster, events: [{ who: 'a', type: '2M' }, { who: 'a', type: '2M' }, { who: 'b', type: '3M' }, { who: 'b', type: 'RD' }] },
    { id: 'g2', date: '2026-01-02', roster: [roster[1]], events: [{ who: 'b', type: '3M' }, { who: 'b', type: 'AST' }] }
  ];
  const [pts, reb, ast] = seasonLeaders(games);
  assert.deepEqual(pts.leaders.map((p) => [p.id, p.average, p.games]), [['a', 4, 1], ['b', 3, 2]]);
  assert.deepEqual(reb.leaders.map((p) => [p.id, p.average]), [['b', 0.5]]);
  assert.deepEqual(ast.leaders.map((p) => [p.id, p.total]), [['b', 1]]);
});
