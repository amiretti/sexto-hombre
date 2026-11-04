import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodLengthSec, periodShort, periodLong, remainingMs, clockStamp, toggleClock, pauseClock, adjustClock,
  formatSeconds, parseClockTime, overtimeCount
} from '../public/src/domain/clock.js';
import { isThreePointer, zoneName, clampToCourt } from '../public/src/domain/court.js';

test('period labels and lengths', () => {
  assert.equal(periodShort(2), '2°C');
  assert.equal(periodShort(5), 'S1');
  assert.equal(periodLong(4), '4° cuarto');
  assert.equal(periodLong(6), 'Suplementario 2');
  assert.equal(periodLengthSec({ periodMin: '12' }, 3), 720);
  assert.equal(periodLengthSec({ periodMin: '12' }, 5), 300);
  assert.equal(overtimeCount(3), 0);
  assert.equal(overtimeCount(6), 2);
});

test('remaining time with running clock', () => {
  const c = { rem: 10000, running: true, t0: 1000 };
  assert.equal(remainingMs(c, 4000), 7000);
  assert.equal(remainingMs(c, 20000), 0);
  assert.equal(clockStamp({ rem: 45340, running: false, t0: 0 }), 45.3);
});

test('toggle, pause and adjust clock', () => {
  const c = { rem: 10000, running: false, t0: 0 };
  assert.equal(toggleClock(c, 1000), true);
  assert.deepEqual(c, { rem: 10000, running: true, t0: 1000 });
  pauseClock(c, 3000);
  assert.deepEqual(c, { rem: 8000, running: false, t0: 1000 });
  assert.equal(toggleClock({ rem: 0, running: false, t0: 0 }), false);
  adjustClock(c, 5, 10);
  assert.equal(c.rem, 10000); // tope del período
  adjustClock(c, -20, 10);
  assert.equal(c.rem, 0);
  const r = { rem: 5000, running: true, t0: 0 };
  adjustClock(r, 1, 600, 1000);
  assert.deepEqual(r, { rem: 5000, running: true, t0: 1000 });
});

test('format and parse clock time', () => {
  assert.equal(formatSeconds(452), '7:32');
  assert.equal(formatSeconds(45.36), '45.3');
  assert.equal(formatSeconds(-3), '0.0');
  assert.equal(parseClockTime('7:32'), 452);
  assert.equal(parseClockTime('45,3'), 45.3);
  assert.equal(parseClockTime('45'), 45);
  assert.equal(parseClockTime('abc'), null);
  assert.equal(parseClockTime(''), null);
});

test('court zones', () => {
  assert.equal(isThreePointer(200, 750), false);
  assert.equal(isThreePointer(1000, 750), true);
  assert.equal(isThreePointer(200, 50), true); // esquina
  assert.equal(zoneName(null, null), '');
  assert.equal(zoneName(300, 750), 'pintura');
  assert.equal(zoneName(2500, 750), 'pintura'); // lado derecho, espejado
  assert.equal(zoneName(200, 50), 'triple esquina');
  assert.equal(zoneName(1000, 750), 'zona de triple');
  assert.equal(zoneName(700, 400), 'media distancia');
});

test('clampToCourt', () => {
  assert.equal(clampToCourt(-61, 10), null);
  assert.equal(clampToCourt(10, 1561), null);
  assert.deepEqual(clampToCourt(-30, 1530), { x: 0, y: 1500 });
  assert.deepEqual(clampToCourt(100, 200), { x: 100, y: 200 });
});
