import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ev } from './fixtures.js';
import { playingTime, formatMinutes } from '../public/src/domain/playing-time.js';
import { playerStats, teamTotals } from '../public/src/domain/stats.js';
import { playerSeries } from '../public/src/domain/player-progress.js';
import { buildGameReport } from '../public/src/application/game-report.js';

const sub = (period, t, inn, out) => ev('SUB', null, { period, t, inn, out });
const clock = (sec, extra = {}) => ({ rem: sec * 1000, running: false, t0: 0, ...extra });

test('en cancha suma, en la banca no: cambio a mitad del cuarto', () => {
  // A falta de 6:00 sale p1 y entra p6; el reloj marca 4:00.
  const g = makeGame({ clock: clock(240), events: [sub(1, 360, ['p6'], ['p1'])] });
  const t = playingTime(g);
  assert.equal(t.p1, 240);   // de 10:00 a 6:00
  assert.equal(t.p6, 120);   // de 6:00 a 4:00
  assert.equal(t.p2, 360);   // todo lo jugado
  assert.equal(t.p7, undefined);
});

test('los cuartos terminados cuentan enteros y el cambio entre cuartos vale para el siguiente', () => {
  const g = makeGame({ period: 3, clock: clock(300), events: [sub(1, 0, ['p6'], ['p1']), sub(3, 600, ['p1'], ['p6'])] });
  const t = playingTime(g);
  assert.equal(t.p1, 600 + 300);  // 1er cuarto y medio 3ro
  assert.equal(t.p6, 600);        // el 2do cuarto
  assert.equal(t.p2, 1500);
});

test('reloj corriendo: suma hasta el ahora', () => {
  const g = makeGame({ clock: clock(600, { running: true, t0: 1000 }) });
  assert.equal(playingTime(g, 1000 + 90000).p1, 90);
});

test('suplementario de 5 minutos y partido terminado', () => {
  const g = makeGame({ status: 'final', period: 5, clock: clock(0) });
  assert.equal(playingTime(g).p1, 4 * 600 + 300);
});

test('cambio cargado tarde (fechado antes) se ordena por el reloj, no por el orden de carga', () => {
  const g = makeGame({ clock: clock(0), events: [sub(1, 200, ['p7'], ['p2']), sub(1, 500, ['p6'], ['p1'])] });
  const t = playingTime(g);
  assert.equal(t.p1, 100); assert.equal(t.p6, 500);
  assert.equal(t.p2, 400); assert.equal(t.p7, 200);
});

test('sin quinteto guardado se reconstruye desde los que están en cancha', () => {
  const g = makeGame({ starters: undefined, onCourt: ['p6', 'p2', 'p3', 'p4', 'p5'], clock: clock(0), events: [sub(1, 400, ['p6'], ['p1'])] });
  const t = playingTime(g);
  assert.equal(t.p1, 200); assert.equal(t.p6, 400);
});

test('expulsado sin reemplazo: quedan 4 en cancha', () => {
  const g = makeGame({ clock: clock(0), events: [sub(1, 300, [], ['p5'])] });
  const t = playingTime(g);
  assert.equal(t.p5, 300); assert.equal(t.p1, 600);
  assert.equal(teamTotals(g).sec, 4 * 600 + 300);
});

test('planilla, PDF y progreso muestran los minutos', () => {
  const g = makeGame({ clock: clock(0), events: [sub(1, 360, ['p6'], ['p1'])] });
  assert.equal(playerStats(g, 'p6').sec, 360);
  assert.equal(formatMinutes(359.9), '5:59');
  assert.equal(formatMinutes(1500), '25:00');
  const r = buildGameReport(g);
  assert.equal(r.rows.find((x) => x.num === '6').min, '6:00');
  assert.equal(r.totals.min, '50:00');
  const s = playerSeries([g], 'p1', 'min');
  assert.deepEqual([s.points[0].value, s.points[0].detail], [4, '4:00']);
  assert.equal(playerSeries([g], null, 'min').points[0].value, null);
});

test('sin duración de cuarto no inventa minutos', () => {
  assert.deepEqual(playingTime(makeGame({ periodMin: '' })), {});
});
