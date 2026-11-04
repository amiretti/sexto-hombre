// Tiempos muertos y pedidos de revisión: detienen el reloj y cuentan por tramo (FIBA).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { timeoutAllowance, timeoutsUsed } from '../public/src/domain/stats.js';
import { eventActor, eventDetail } from '../public/src/domain/describe.js';
import { applyEditDraft, newEditDraft } from '../public/src/domain/game.js';
import { createGameSession } from '../public/src/application/game-session.js';
import { historyCsv } from '../public/src/application/csv-export.js';
import { makeGame, ev } from './fixtures.js';

const fakeStore = () => ({ saveGame: () => Promise.resolve(), putEvent: () => Promise.resolve(), deleteEvent: () => Promise.resolve() });

test('cupos de tiempos muertos: 2, 3 y 1 por suplementario', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(timeoutAllowance), [2, 2, 3, 3, 1, 1]);
});

test('timeoutsUsed cuenta por equipo y por tramo', () => {
  const g = makeGame();
  g.events.push(ev('TO', null, { team: 'us', period: 1 }), ev('TO', null, { team: 'us', period: 2 }), ev('TO', null, { team: 'them', period: 2 }), ev('TO', null, { team: 'us', period: 3 }));
  assert.equal(timeoutsUsed(g, 'us', 2), 2);
  assert.equal(timeoutsUsed(g, 'them', 1), 1);
  assert.equal(timeoutsUsed(g, 'us', 4), 1);
  assert.equal(timeoutsUsed(g, 'us', 5), 0);
});

test('recordStoppage detiene el reloj y registra la acción', () => {
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  try {
    const session = createGameSession({ store: fakeStore(), onSaveError: () => {} });
    const g = makeGame({ clock: { rem: 300000, running: true, t0: 100000 } });
    session.open(g);
    mock.timers.tick(12000);
    const r = session.recordStoppage('TO', 'them');
    assert.equal(g.clock.running, false);
    assert.equal(g.clock.rem, 288000);
    assert.equal(r.event.type, 'TO'); assert.equal(r.event.team, 'them'); assert.equal(r.event.t, 288);
    assert.match(r.message, /Tiempo muerto Deportivo Norte · 1 de 2/);
    session.recordStoppage('TO', 'them');
    const third = session.recordStoppage('TO', 'them');
    assert.equal(third.warn, true);
    const rev = session.recordStoppage('REV');
    assert.equal(rev.event.team, undefined);
    assert.match(rev.message, /Pedido de revisión/);
  } finally { mock.timers.reset(); }
});

test('acciones sin jugador en historial, CSV y edición', () => {
  const g = makeGame();
  const to = ev('TO', null, { team: 'us' }), rev = ev('REV', null);
  g.events.push(to, rev);
  assert.equal(eventActor(g, to), 'Unión Central');
  assert.equal(eventActor(g, rev), 'Partido');
  assert.equal(eventDetail(g, to), '');
  assert.ok(historyCsv(g).includes('Unión Central,Tiempo muerto'));
  const d = newEditDraft(to); d.timeStr = '5:00'; d.who = 'p1'; d.type = '2M';
  assert.equal(applyEditDraft(g, to, d), '');
  assert.equal(to.type, 'TO'); assert.equal(to.who, null); assert.equal(to.t, 300);
});
