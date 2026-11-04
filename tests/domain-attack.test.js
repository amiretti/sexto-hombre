// Dirección de ataque, mitad de cancha y falta recibida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attackingSide, setAttackingSide, flipAttackingSide, courtHalf, isThreePointer } from '../public/src/domain/court.js';
import { normalizeSubtype, subtypeLabel, FREE_THROWS_FOR } from '../public/src/domain/catalog.js';
import { eventDetail } from '../public/src/domain/describe.js';
import { playerStats } from '../public/src/domain/stats.js';
import { createGame, blankSetup } from '../public/src/domain/game-setup.js';
import { makeGame, ev } from './fixtures.js';

test('la dirección se invierte en el 3° cuarto y sigue así en suplementarios', () => {
  const g = makeGame({ attackFirstHalf: 'right' });
  assert.equal(attackingSide(g, 1), 'right');
  assert.equal(attackingSide(g, 2), 'right');
  assert.equal(attackingSide(g, 3), 'left');
  assert.equal(attackingSide(g, 4), 'left');
  assert.equal(attackingSide(g, 5), 'left');
  assert.equal(attackingSide(makeGame(), 1), null, 'partidos viejos sin dirección');
});

test('setAttackingSide y flipAttackingSide deducen el primer tiempo', () => {
  const g = makeGame({ period: 3 });
  setAttackingSide(g, 'right');
  assert.equal(g.attackFirstHalf, 'left');
  assert.equal(attackingSide(g), 'right');
  flipAttackingSide(g);
  assert.equal(attackingSide(g), 'left');
  const legacy = makeGame();
  flipAttackingSide(legacy);
  assert.equal(attackingSide(legacy), 'right');
});

test('courtHalf distingue campo rival y propio', () => {
  const g = makeGame({ attackFirstHalf: 'right' });
  assert.equal(courtHalf(g, 2500), 'off');
  assert.equal(courtHalf(g, 300), 'def');
  assert.equal(courtHalf(g, 300, 3), 'off');
  assert.equal(courtHalf(g, null), null);
  assert.equal(courtHalf(makeGame(), 2500), null);
});

test('isThreePointer respecto del aro atacado', () => {
  assert.equal(isThreePointer(2500, 750), false, 'cerca del aro derecho');
  assert.equal(isThreePointer(2500, 750, 'left'), true, 'lejos del aro izquierdo');
  assert.equal(isThreePointer(300, 750, 'left'), false);
});

test('falta recibida: subtipos, libres y estadística', () => {
  assert.equal(normalizeSubtype('FD', 'x'), 'none');
  assert.equal(subtypeLabel('FD', 'shot3'), 'En tiro de 3 · 3 libres');
  assert.deepEqual([FREE_THROWS_FOR.none, FREE_THROWS_FOR.shot2, FREE_THROWS_FOR.shot3, FREE_THROWS_FOR.and1], [0, 2, 3, 1]);
  const g = makeGame();
  g.events.push(ev('FD', 'p1', { sub: 'shot2' }), ev('FT', 'p1', { att: 2, made: 1 }));
  assert.equal(eventDetail(g, g.events[0]), 'En tiro de 2 · 2 libres');
  const s = playerStats(g, 'p1');
  assert.equal(s.fd, 1); assert.equal(s.pts, 1); assert.equal(s.fouls, 0);
});

test('la previa guarda hacia dónde atacamos en el 1er tiempo', () => {
  const team = { id: 't', name: 'X', players: Array.from({ length: 5 }, (_, i) => ({ id: 'p' + i, num: String(i + 4), name: 'J' + i })) };
  const setup = { ...blankSetup(), opponent: 'Rival', attack: 'left', sel: Object.fromEntries(team.players.map((p) => [p.id, { in: true, starter: true }])) };
  assert.equal(createGame(setup, team).game.attackFirstHalf, 'left');
  assert.equal(createGame({ ...setup, attack: undefined }, team).game.attackFirstHalf, 'right');
});
