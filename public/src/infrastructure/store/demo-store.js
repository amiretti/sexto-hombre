// Adaptador demo: sin login, datos en localStorage de este dispositivo.

import { createPendingTracker } from './pending-tracker.js';
import { clean, sortGames, sortTeams, sortClubs, sortEvents } from './serialization.js';

const KEY = 'pb-demo-db-v1';
const DEMO_USER = { uid: 'demo', email: 'demo@local', name: 'Modo demo', photo: '' };

export function createDemoStore(storage = globalThis.localStorage) {
  const pending = createPendingTracker();
  const subs = new Set();

  const read = () => {
    let db;
    try { db = JSON.parse(storage.getItem(KEY) || 'null'); } catch (e) { /* datos corruptos: arrancamos vacío */ }
    db = db || { games: {}, events: {}, users: {} };
    db.teams = db.teams || {};
    db.clubs = db.clubs || {};
    return db;
  };
  const write = (db) => {
    try { storage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* sin almacenamiento */ }
    subs.forEach((f) => f());
  };
  /** Escribe y cuenta la escritura como pendiente (igual que Firebase). */
  const commit = (db) => { write(db); return pending.track(Promise.resolve()); };
  const ownedList = (map, uid) => Object.keys(map).map((id) => ({ id, ...map[id] })).filter((x) => x.ownerUid === uid);
  const watch = (emit) => { subs.add(emit); emit(); return () => subs.delete(emit); };
  const upsert = (map, id, data) => { map[id] = { ...(map[id] || {}), ...clean(data), ownerUid: DEMO_USER.uid, updatedAt: Date.now() }; };

  return {
    mode: 'demo',
    onAuth(cb) { setTimeout(() => cb(DEMO_USER), 0); return () => {}; },
    async signIn() {},
    async signOut() {},
    async isAllowed() { return true; },
    async getProfile(uid) { return read().users[uid] || null; },
    async saveProfile(uid, data) { const db = read(); db.users[uid] = { ...(db.users[uid] || {}), ...clean(data) }; write(db); },
    watchGames(uid, cb) { return watch(() => cb(sortGames(ownedList(read().games, uid)), false)); },
    watchTeams(uid, cb) { return watch(() => cb(sortTeams(ownedList(read().teams, uid)))); },
    saveTeam(id, data) { const db = read(); upsert(db.teams, id, data); return commit(db); },
    watchClubs(uid, cb) { return watch(() => cb(sortClubs(ownedList(read().clubs, uid)))); },
    saveClub(id, data) { const db = read(); upsert(db.clubs, id, data); return commit(db); },
    async loadGame(id) {
      const db = read(), g = db.games[id];
      if (!g) throw new Error('No se encontró el partido.');
      return { game: { id, ...clean(g) }, events: sortEvents(Object.values(db.events[id] || {})) };
    },
    saveGame(id, data) { const db = read(); upsert(db.games, id, data); return commit(db); },
    putEvent(gameId, ev) {
      const db = read();
      (db.events[gameId] = db.events[gameId] || {})[ev.id] = { ...clean(ev), deleted: false };
      return commit(db);
    },
    deleteEvent(gameId, ev) {
      const db = read(), m = db.events[gameId] || {};
      if (m[ev.id]) { m[ev.id].deleted = true; m[ev.id].rev = (ev.rev || 1) + 1; }
      return commit(db);
    },
    async claimGame() { return { ok: true }; },
    async releaseGame() {},
    watchGameLock() { return () => {}; },
    onPending(cb) { return pending.on(cb); }
  };
}
