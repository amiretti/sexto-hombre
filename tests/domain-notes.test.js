import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from './fixtures.js';
import { setGameNotes, normalizeNotes, gameDocument, NOTES_MAX } from '../public/src/domain/game.js';
import { buildGameReport } from '../public/src/application/game-report.js';

test('observaciones: se normalizan y se avisa si cambiaron', () => {
  assert.equal(normalizeNotes('  Buen partido\r\nfalta trabajar rebote  '), 'Buen partido\nfalta trabajar rebote');
  assert.equal(normalizeNotes(null), '');
  assert.equal(normalizeNotes('x'.repeat(NOTES_MAX + 50)).length, NOTES_MAX);
  const g = makeGame({ status: 'final' });
  assert.equal(setGameNotes(g, '   '), false);          // vacío sobre vacío: no cambia
  assert.equal(setGameNotes(g, 'Lesión de #7'), true);
  assert.equal(setGameNotes(g, 'Lesión de #7 '), false);
  assert.equal(setGameNotes(g, ''), true);               // se pueden borrar
  assert.equal(g.notes, '');
});

test('observaciones: se guardan con el partido y salen en el reporte', () => {
  const g = makeGame({ status: 'final' });
  setGameNotes(g, 'Arbitraje correcto.\nPresión en el 3er cuarto.');
  assert.equal(gameDocument(g).notes, 'Arbitraje correcto.\nPresión en el 3er cuarto.');
  assert.equal(buildGameReport(g).notes, 'Arbitraje correcto.\nPresión en el 3er cuarto.');
  assert.equal(buildGameReport(makeGame()).notes, '');
});
