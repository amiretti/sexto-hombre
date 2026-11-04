// Bloqueo de partido por dispositivo: un solo dispositivo carga a la vez.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createGameLock, LOCK_TTL_MS, lockAgeText } from '../public/src/application/game-lock.js';
import { createGameSession } from '../public/src/application/game-session.js';
import { gameDocument } from '../public/src/domain/game.js';
import { makeGame } from './fixtures.js';

/** Store falso con la misma semántica que Firebase (transacción + listener). */
function fakeStore() {
  const locks = {}, watchers = {};
  const emit = (id) => (watchers[id] || []).forEach((cb) => cb(locks[id] || null));
  return {
    locks,
    async claimGame(id, holder, { force = false, ttlMs }) {
      const lock = locks[id], t = Date.now();
      if (!force && lock && lock.id !== holder.id && t - lock.at < ttlMs) return { ok: false, holder: lock };
      locks[id] = { id: holder.id, label: holder.label, at: t };
      emit(id);
      return { ok: true };
    },
    async releaseGame(id, holderId) { if (locks[id] && locks[id].id === holderId) { delete locks[id]; emit(id); } },
    watchGameLock(id, cb) { (watchers[id] = watchers[id] || []).push(cb); cb(locks[id] || null); return () => { watchers[id] = watchers[id].filter((x) => x !== cb); }; }
  };
}

const web = { id: 'web', label: 'computadora Windows' }, phone = { id: 'phone', label: 'celular Android' };

test('el segundo dispositivo no puede abrir el partido', async () => {
  mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_000_000 });
  try {
    const store = fakeStore();
    const a = createGameLock({ store, device: web, onLost: () => assert.fail('no debería perderlo') });
    const b = createGameLock({ store, device: phone, onLost: () => {} });
    assert.deepEqual(await a.acquire('g1'), { ok: true });
    const r = await b.acquire('g1');
    assert.equal(r.ok, false);
    assert.equal(r.holder.label, 'computadora Windows');
    assert.equal(lockAgeText(r.holder.at), 'hace 0 s');
  } finally { mock.timers.reset(); }
});

test('tomar el control echa al otro dispositivo', async () => {
  mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_000_000 });
  try {
    const store = fakeStore();
    const lostBy = [];
    const a = createGameLock({ store, device: web, onLost: (holder, id) => lostBy.push([holder.label, id]) });
    const b = createGameLock({ store, device: phone, onLost: () => assert.fail('el que toma no lo pierde') });
    await a.acquire('g1');
    mock.timers.tick(1000);
    assert.equal((await b.acquire('g1', true)).ok, true);
    assert.deepEqual(lostBy, [['celular Android', 'g1']]);
    assert.equal(store.locks.g1.id, 'phone');
  } finally { mock.timers.reset(); }
});

test('el bloqueo se renueva y vence si el dispositivo desaparece', async () => {
  mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_000_000 });
  try {
    const store = fakeStore();
    const a = createGameLock({ store, device: web, onLost: () => {} });
    await a.acquire('g1');
    mock.timers.tick(LOCK_TTL_MS * 2); // los latidos lo mantienen vivo
    await Promise.resolve();
    const b = createGameLock({ store, device: phone, onLost: () => {} });
    assert.equal((await b.acquire('g1')).ok, false, 'sigue tomado mientras late');
    a.release();
    assert.equal(store.locks.g1, undefined, 'al volver al inicio lo suelta');
    store.locks.g1 = { id: 'web', label: 'x', at: Date.now() - LOCK_TTL_MS - 1 };
    assert.equal((await b.acquire('g1')).ok, true, 'un bloqueo vencido no impide abrir');
  } finally { mock.timers.reset(); }
});

test('un bloqueo viejo en la caché no echa al que abrió', async () => {
  mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_000_000 });
  try {
    const store = fakeStore();
    store.locks.g1 = { id: 'phone', label: 'celular Android', at: Date.now() - 60_000 };
    let lost = false;
    const offlineStore = { ...store, claimGame: async () => ({ ok: true, offline: true }) };
    const a = createGameLock({ store: offlineStore, device: web, onLost: () => { lost = true; } });
    await a.acquire('g1');
    assert.equal(lost, false);
  } finally { mock.timers.reset(); }
});

test('el documento del partido no pisa el bloqueo y la sesión abandonada no guarda', () => {
  const g = makeGame({ lock: { id: 'web', at: 1 } });
  assert.equal('lock' in gameDocument(g), false);
  const saves = [];
  const session = createGameSession({ store: { saveGame: (id, d) => { saves.push(d); return Promise.resolve(); }, putEvent: () => Promise.resolve(), deleteEvent: () => Promise.resolve() }, onSaveError: () => {} });
  session.open(makeGame());
  session.abandon();
  session.close();
  assert.equal(saves.length, 0);
});
