import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ev } from './fixtures.js';
import { createGameSession } from '../public/src/application/game-session.js';
import { teamTotals, teamTurnovers, playerStats } from '../public/src/domain/stats.js';
import { eventActor, eventDetail } from '../public/src/domain/describe.js';
import { isTeamEvent } from '../public/src/domain/catalog.js';
import { buildGameReport } from '../public/src/application/game-report.js';
import { historyCsv } from '../public/src/application/csv-export.js';

const store = { saveGame: () => Promise.resolve(), putEvent: () => Promise.resolve(), deleteEvent: () => Promise.resolve() };

test('24 y 8 segundos: pérdida del equipo, sin jugador ni ubicación, y detiene el reloj', () => {
  const g = makeGame({ clock: { rem: 300000, running: true, t0: Date.now() } });
  const s = createGameSession({ store, onSaveError: (e) => { throw e; } });
  s.open(g);
  const r = s.recordStoppage('TTOV', undefined, '24s');
  assert.equal(r.message, 'Pérdida de equipo · 24 segundos · reloj detenido');
  assert.equal(g.clock.running, false);
  assert.deepEqual([r.event.who, r.event.x, r.event.y, r.event.sub], [null, null, null, '24s']);
  assert.equal(s.recordStoppage('TTOV', undefined, '8s').event.sub, '8s');
  assert.equal(s.recordStoppage('TTOV', undefined, 'raro').event.sub, '24s');
});

test('suman en la fila Equipo, no en ningún jugador', () => {
  const g = makeGame({ events: [ev('TTOV', null, { sub: '24s' }), ev('TTOV', null, { sub: '8s' }), ev('TOV', 'p1', { sub: 'pase' })] });
  assert.equal(teamTurnovers(g), 2);
  assert.equal(teamTotals(g).tov, 3);
  assert.equal(playerStats(g, 'p1').tov, 1);
  assert.equal(isTeamEvent('TTOV'), true);
  const e = g.events[0];
  assert.equal(eventActor(g, e), 'Unión Central');
  assert.equal(eventDetail(g, e), '24 segundos');
  const r = buildGameReport(g);
  assert.equal(r.totals.pe, 3);
  assert.equal(r.teamTurnovers, 2);
  assert.match(historyCsv(g), /Unión Central,Pérdida de equipo,24 segundos/);
});
