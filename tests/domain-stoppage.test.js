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
    assert.match(r.message, /Tiempo muerto Deportivo Norte · le queda 1/);
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

test('últimos 2 minutos del 4° cuarto: máximo 2 tiempos muertos', async () => {
  const { timeoutsLeft } = await import('../public/src/domain/stats.js');
  const g = makeGame({ period: 4 });
  assert.equal(timeoutsLeft(g, 'us', 4, 300), 3, 'antes de los 2:00 quedan 3');
  assert.equal(timeoutsLeft(g, 'us', 4, 120), 2, 'sin usar ninguno, en los 2:00 pierde uno');
  g.events.push(ev('TO', null, { team: 'us', period: 3, t: 400 }));
  assert.equal(timeoutsLeft(g, 'us', 4, 90), 2, 'uno antes: le quedan 2 y puede usar los dos');
  g.events.push(ev('TO', null, { team: 'us', period: 4, t: 100 }));
  assert.equal(timeoutsLeft(g, 'us', 4, 60), 1);
  g.events.push(ev('TO', null, { team: 'us', period: 4, t: 50 }));
  assert.equal(timeoutsLeft(g, 'us', 4, 30), 0);
  const h = makeGame({ period: 4 });
  h.events.push(ev('TO', null, { team: 'them', period: 4, t: 110 }), ev('TO', null, { team: 'them', period: 4, t: 80 }));
  assert.equal(timeoutsLeft(h, 'them', 4, 40), 0, 'dos en los últimos 2 minutos agotan el tramo');
  assert.equal(timeoutsLeft(h, 'them', 5, 300), 1, 'el suplementario tiene el suyo');
});

test('el reporte del PDF lista los tiempos muertos por tramo', async () => {
  const { buildGameReport } = await import('../public/src/application/game-report.js');
  const g = makeGame({ period: 5 });
  g.events.push(ev('TO', null, { team: 'us', period: 1 }), ev('TO', null, { team: 'them', period: 4 }), ev('TO', null, { team: 'them', period: 5 }));
  const r = buildGameReport(g, { now: new Date(2026, 10, 4, 12, 0) });
  assert.equal(r.timeoutsText, 'Unión Central 1°T 1 · 2°T 0 · S1 0     Deportivo Norte 1°T 0 · 2°T 1 · S1 1');
});
