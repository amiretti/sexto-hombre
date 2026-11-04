// Qué acciones ponen el reloj a correr y sincronización con el tablero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLiveBallAction } from '../public/src/domain/catalog.js';
import { runClockFrom, remainingMs } from '../public/src/domain/clock.js';

test('acciones con pelota viva arrancan el reloj; las que lo detienen, no', () => {
  for (const t of ['2M', '2X', '3M', '3X', 'RO', 'RD', 'AST', 'STL', 'BLK']) assert.equal(isLiveBallAction(t), true, t);
  assert.equal(isLiveBallAction('TOV', 'pase'), true);
  assert.equal(isLiveBallAction('TOV', 'manejo'), true);
  for (const s of ['pasos', 'doble', 'fuera', '3s', '24s', 'atras', 'otra']) assert.equal(isLiveBallAction('TOV', s), false, s);
  for (const t of ['FT', 'PF', 'FD', 'TF', 'UF', 'DF', 'TO', 'REV', 'SUB']) assert.equal(isLiveBallAction(t), false, t);
});

test('runClockFrom pone el reloj a correr desde el tiempo del tablero', () => {
  const c = { rem: 500000, running: false, t0: 0 };
  runClockFrom(c, 452, 600, 1000);
  assert.deepEqual(c, { rem: 452000, running: true, t0: 1000 });
  assert.equal(remainingMs(c, 3000), 450000);
  runClockFrom(c, 900, 600, 1000);
  assert.equal(c.rem, 600000, 'no pasa la duración del período');
  runClockFrom(c, 0, 600, 1000);
  assert.equal(c.running, false, 'en cero no corre');
});
