import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createGameSession } from '../public/src/application/game-session.js';
import { historyCsv, boxScoreCsv } from '../public/src/application/csv-export.js';
import { buildGameReport } from '../public/src/application/game-report.js';
import { createDemoStore } from '../public/src/infrastructure/store/demo-store.js';
import { createPendingTracker } from '../public/src/infrastructure/store/pending-tracker.js';
import { makeGame, ev } from './fixtures.js';

function fakeStore() {
  const calls = [];
  const ok = (name) => (...args) => { calls.push([name, ...args]); return Promise.resolve(); };
  return { calls, saveGame: ok('saveGame'), putEvent: ok('putEvent'), deleteEvent: ok('deleteEvent') };
}

function session(game) {
  const store = fakeStore();
  const s = createGameSession({ store, onSaveError: (e) => { throw e; } });
  s.open(game);
  return { s, store };
}

const moment = { period: 1, t: 300, x: null, y: null };

test('recordPlay: points message', () => {
  const { s, store } = session(makeGame());
  const r = s.recordPlay(moment, { who: 'p1', type: '2M' });
  assert.equal(r.message, '#4 Ferreyra · Doble convertido · +2');
  assert.equal(r.warn, false);
  assert.equal(r.forced, null);
  assert.equal(store.calls[0][0], 'putEvent');
  const ft = s.recordPlay(moment, { who: 'p2', type: 'FT', att: 2, made: 1 });
  assert.equal(ft.message, '#5 Acosta · Tiros libres · 1 de 2 · +1');
  s.close();
});

test('recordPlay: 5th foul on court forces substitution and stops clock', () => {
  const g = makeGame({ clock: { rem: 60000, running: true, t0: Date.now() }, events: Array.from({ length: 4 }, () => ev('PF', 'p1', { period: 2 })) });
  const { s } = session(g);
  const r = s.recordPlay(moment, { who: 'p1', type: 'PF', sub: 'none' });
  assert.equal(r.forced.out, 'p1');
  assert.equal(r.forced.why, '5 faltas');
  assert.equal(r.forced.evId, r.event.id);
  assert.equal(g.clock.running, false);
  s.close();
});

test('recordPlay: exclusion on bench and blocked player', () => {
  const { s } = session(makeGame({ events: [ev('TF', 'p6')] }));
  const r = s.recordPlay(moment, { who: 'p6', type: 'TF' });
  assert.equal(r.message, '#6 Sosa: Descalificado (T/U). Queda fuera del partido.');
  assert.equal(r.warn, true);
  assert.equal(s.recordPlay(moment, { who: 'p6', type: '2M' }).error, '#6 Sosa ya está fuera del partido.');
  s.close();
});

test('recordPlay: 4th team foul warning and staff disqualified', () => {
  const { s } = session(makeGame({ events: [ev('PF', 'p1'), ev('PF', 'p2'), ev('PF', 'p3')] }));
  const r = s.recordPlay(moment, { who: 'p4', type: 'PF', sub: 'none' });
  assert.equal(r.message, '#9 Ríos · Falta personal · Sin tiro · 4 faltas de equipo');
  assert.equal(r.warn, true);
  s.recordPlay(moment, { who: 'coach', type: 'TF' });
  const d = s.recordPlay(moment, { who: 'coach', type: 'TF' });
  assert.equal(d.message, 'DT descalificado (DT: 2 C · Banca: 0 B)');
  assert.equal(s.recordPlay(moment, { who: 'coach', type: 'TF' }).error, 'El DT ya está descalificado: no se le pueden cargar más faltas.');
  s.close();
});

test('persist is debounced; delete/update hit the store', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { s, store } = session(makeGame());
    const e = s.addEvent({ period: 1, t: 1, who: 'p1', type: '2M' });
    s.schedulePersist();
    assert.equal(store.calls.filter((c) => c[0] === 'saveGame').length, 0);
    mock.timers.tick(349);
    assert.equal(store.calls.filter((c) => c[0] === 'saveGame').length, 0);
    mock.timers.tick(1);
    const saves = store.calls.filter((c) => c[0] === 'saveGame');
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0][2].summary, { us: 2, them: 0 });
    s.updateEvent(e);
    assert.equal(e.rev, 2);
    assert.equal(s.deleteEvent(e.id).id, e.id);
    assert.equal(s.deleteEvent('nope'), null);
    assert.ok(store.calls.some((c) => c[0] === 'deleteEvent'));
    s.close();
    assert.equal(s.game, null);
  } finally {
    mock.timers.reset();
  }
});

test('csv exports', () => {
  const g = makeGame({ events: [ev('3M', 'p1', { x: 1000, y: 750, period: 1, t: 100 }), ev('TOV', 'p2', { sub: 'pase', period: 1, t: 200 })] });
  const lines = historyCsv(g).split('\n');
  assert.equal(lines[0], 'Periodo,Tiempo,Numero,Jugador,Accion,Detalle,Puntos,Zona,X_cm,Y_cm');
  assert.equal(lines[1], '1°C,3:20,5,#5 Bruno Acosta,Pérdida,Mal pase,0,,,');
  assert.equal(lines[2], '1°C,1:40,4,#4 Tomás Ferreyra,Triple convertido,,3,zona de triple,1000,750');
  const box = boxScoreCsv(g).split('\n');
  assert.equal(box.length, 8);
  assert.equal(box[1], '4,Tomás Ferreyra,3,0,0,1,1,0,0,0,0,0,0,0,0,0,0');
  assert.equal(historyCsv(makeGame({ coach: 'a,b', events: [ev('TF', 'coach')] })).split('\n')[1].includes('"DT · a,b"'), true);
});

test('game report', () => {
  const g = makeGame({
    venue: 'away', status: 'final', period: 5, oppP: { 1: 10 },
    events: [ev('2M', 'p1'), ev('2X', 'p1'), ev('TF', 'p2'), ev('UF', 'p2'), ev('TF', 'coach')]
  });
  const r = buildGameReport(g, { generatedBy: 'Ana', now: new Date(2026, 10, 4, 18, 5) });
  assert.equal(r.away, true);
  assert.equal(r.statusText, 'Final tras 1 suplementario');
  assert.equal(r.dateText, '04/11/2026');
  assert.deepEqual([r.us, r.them], [2, 10]);
  assert.equal(r.periods.length, 5);
  assert.equal(r.periods[4].label, 'S1');
  assert.equal(r.rows[0].t2, '1/2');
  assert.equal(r.rows[1].fc, '2 (1T 1U)');
  assert.equal(r.rows[1].outWhy, 'Descalificado (T/U)');
  assert.equal(r.totals.t2, '1/2 (50%)');
  assert.equal(r.totals.t3, '0/0');
  assert.equal(r.teamFoulsText, '1°C 2   2°C 0   3°C 0   4°C 0');
  assert.equal(r.staffText, 'DT 1 técnica · Banca 0');
  assert.equal(r.generatedBy, 'Ana');
  const live = buildGameReport(makeGame({ period: 2, clock: { rem: 452000, running: false, t0: 0 } }));
  assert.equal(live.statusText, 'En juego · 2° cuarto · 7:32 por jugar');
});

test('demo store round trip', async () => {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  const store = createDemoStore(storage);
  const seen = [];
  const off = store.watchGames('demo', (list) => seen.push(list.map((x) => x.id)));
  await store.saveGame('g1', { team: 'A', updatedAt: 1 });
  await store.putEvent('g1', { id: 'e2', seq: 2, type: '2M' });
  await store.putEvent('g1', { id: 'e1', seq: 1, type: '3M' });
  await store.deleteEvent('g1', { id: 'e2', rev: 1 });
  const { game, events } = await store.loadGame('g1');
  assert.equal(game.team, 'A');
  assert.deepEqual(events, [{ id: 'e1', seq: 1, type: '3M' }]);
  await store.saveGame('g1', { deleted: true });
  assert.deepEqual(seen.at(-1), []);
  off();
  await assert.rejects(store.loadGame('zz'), /No se encontró/);
});

test('pending tracker counts in-flight writes', async () => {
  const t = createPendingTracker();
  const seen = [];
  t.on((n) => seen.push(n));
  await t.track(Promise.resolve());
  assert.deepEqual(seen, [0, 1, 0]);
});
