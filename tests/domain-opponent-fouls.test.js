import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ev } from './fixtures.js';
import { opponentTeamFouls, teamFouls, playerStats, PENALTY_FOULS } from '../public/src/domain/stats.js';
import { FREE_THROWS_FOR, subtypeLabel, normalizeSubtype } from '../public/src/domain/catalog.js';
import { buildGameReport } from '../public/src/application/game-report.js';

const fd = (period, sub = 'none', who = 'p1') => ev('FD', who, { period, sub });

test('cada falta recibida es una falta de equipo del rival, por cuarto', () => {
  const g = makeGame({ period: 2, events: [fd(1), fd(1, 'shot2'), fd(1, 'and1'), fd(2), ev('PF', 'p2', { period: 1, sub: 'none' })] });
  assert.equal(opponentTeamFouls(g, 1), 3);
  assert.equal(opponentTeamFouls(g, 2), 1);
  assert.equal(teamFouls(g, 1), 1);   // las nuestras no se mezclan
});

test('los suplementarios suman con el 4° cuarto', () => {
  const g = makeGame({ period: 5, events: [fd(4), fd(4), fd(4), fd(5)] });
  assert.equal(opponentTeamFouls(g, 5), 4);
  assert.equal(opponentTeamFouls(g, 5) >= PENALTY_FOULS, true);
});

test('falta sin tiro con el rival en penalización: 2 libres y sigue siendo falta recibida', () => {
  assert.equal(FREE_THROWS_FOR.bonus, 2);
  assert.equal(FREE_THROWS_FOR.none, 0);
  assert.equal(subtypeLabel('FD', 'bonus'), 'Sin tiro · rival en penalización · 2 libres');
  assert.equal(normalizeSubtype('FD', 'bonus'), 'bonus');
  const g = makeGame({ events: [fd(1, 'bonus')] });
  assert.equal(playerStats(g, 'p1').fd, 1);
  assert.equal(opponentTeamFouls(g, 1), 1);
});

test('la planilla en PDF lleva las faltas del rival', () => {
  const r = buildGameReport(makeGame({ events: [fd(1), fd(1), fd(3)] }));
  assert.equal(r.oppFoulsText, '1°C 2   2°C 0   3°C 1   4°C 0');
});
