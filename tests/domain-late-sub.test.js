// Cambio olvidado: un jugador de la banca participa de una jugada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLateSubstitution, substitutionEventAt } from '../public/src/domain/game.js';
import { makeGame, ev } from './fixtures.js';

test('entra el de la banca por el elegido', () => {
  const g = makeGame();
  assert.deepEqual(applyLateSubstitution(g, 'p6', 'p3'), { inn: ['p6'], out: ['p3'] });
  assert.deepEqual(g.onCourt, ['p1', 'p2', 'p6', 'p4', 'p5']);
});

test('no se puede: ya está en cancha, sale alguien que no está, o está excluido', () => {
  const g = makeGame();
  assert.equal(applyLateSubstitution(g, 'p1', 'p2'), null);
  assert.equal(applyLateSubstitution(g, 'p6', 'p7'), null);
  for (let i = 0; i < 5; i++) g.events.push(ev('PF', 'p6'));
  assert.equal(applyLateSubstitution(g, 'p6', 'p1'), null);
  assert.deepEqual(g.onCourt, ['p1', 'p2', 'p3', 'p4', 'p5']);
});

test('sin que salga nadie solo si hay lugar', () => {
  const full = makeGame();
  assert.equal(applyLateSubstitution(full, 'p6', null), null);
  const short = makeGame({ onCourt: ['p1', 'p2', 'p3', 'p4'] });
  assert.deepEqual(applyLateSubstitution(short, 'p6', null), { inn: ['p6'], out: [] });
  assert.equal(short.onCourt.length, 5);
});

test('el cambio se fecha en el momento de la jugada', () => {
  const e = substitutionEventAt({ period: 2, t: 123.4, x: 10, y: 20 }, { inn: ['p6'], out: ['p1'] });
  assert.deepEqual(e, { period: 2, t: 123.4, x: null, y: null, who: null, type: 'SUB', inn: ['p6'], out: ['p1'] });
});
