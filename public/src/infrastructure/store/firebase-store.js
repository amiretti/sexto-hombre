// Adaptador Firebase (Auth + Firestore). El SDK se carga desde el CDN.

import { createPendingTracker } from './pending-tracker.js';
import { clean, userInfo, sortGames, sortTeams, sortClubs, sortEvents } from './serialization.js';
import { clearLocalAppData } from '../platform/local-data.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CLAIM_TIMEOUT_MS = 6000;
const REDIRECT_FALLBACK = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'];

const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

/** Última respuesta de la lista blanca, para poder entrar sin señal. */
const allowCache = {
  key: (uid) => 'pb-allowed-' + uid,
  set(uid, ok) { try { localStorage.setItem(this.key(uid), ok ? '1' : '0'); } catch (e) { /* sin almacenamiento */ } },
  get(uid) { try { return localStorage.getItem(this.key(uid)) === '1'; } catch (e) { return false; } }
};

export async function createFirebaseStore(config) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js')
  ]);
  const fbApp = initializeApp(config);
  const auth = A.getAuth(fbApp);
  const db = F.initializeFirestore(fbApp, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true
  });
  const pending = createPendingTracker();
  let current = null;

  A.getRedirectResult(auth).catch(() => {});

  // Primera emisión de un listener: datos en caché al instante si hay, del servidor si no.
  const once = (ref) => new Promise((resolve, reject) => {
    const off = F.onSnapshot(ref, (snap) => { off(); resolve(snap); }, reject);
  });
  const owned = (data) => clean({ ...data, ownerUid: current.uid, updatedAt: Date.now() });
  const watchOwned = (collection, uid, onList, onError) => {
    const q = F.query(F.collection(db, collection), F.where('ownerUid', '==', uid));
    return F.onSnapshot(q, (snap) => onList(snap.docs.map((d) => ({ id: d.id, ...d.data() })), snap), onError);
  };

  return {
    mode: 'firebase',
    onAuth(cb) { return A.onAuthStateChanged(auth, (u) => { current = u; cb(u ? userInfo(u) : null); }); },
    async signIn() {
      const provider = new A.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      if (isStandalone()) return A.signInWithRedirect(auth, provider);
      try { await A.signInWithPopup(auth, provider); } catch (e) {
        if (REDIRECT_FALLBACK.includes(e.code)) return A.signInWithRedirect(auth, provider);
        if (e.code === 'auth/popup-closed-by-user') return;
        throw e;
      }
    },
    /**
     * Cierra la sesión y borra lo que quedó en el dispositivo (tablets compartidas):
     * caché de Firestore en IndexedDB y datos locales de la app. Después hay que recargar la página,
     * porque la instancia de Firestore queda terminada.
     */
    async signOut() {
      await A.signOut(auth);
      try {
        await F.terminate(db);
        await F.clearIndexedDbPersistence(db);
      } catch (e) {
        // Falla si la app está abierta en otra pestaña: la caché se borra al cerrar sesión ahí.
        console.warn('No se pudo borrar la caché local de Firestore', e);
      }
      clearLocalAppData();
    },
    async isAllowed(user) {
      try {
        const ok = (await F.getDoc(F.doc(db, 'allowlist', user.email.toLowerCase()))).exists();
        allowCache.set(user.uid, ok);
        return ok;
      } catch (e) {
        // Sin permiso = no está en la lista. Sin red = usamos la última respuesta conocida.
        if (e.code === 'permission-denied') { allowCache.set(user.uid, false); return false; }
        return allowCache.get(user.uid);
      }
    },
    async getProfile(uid) {
      try { const s = await once(F.doc(db, 'users', uid)); return s.exists() ? s.data() : null; } catch (e) { return null; }
    },
    saveProfile(uid, data) {
      return pending.track(F.setDoc(F.doc(db, 'users', uid), clean({ ...data, updatedAt: Date.now() }), { merge: true }));
    },
    watchGames(uid, cb) {
      return watchOwned('games', uid, (list, snap) => cb(sortGames(list), snap.metadata.fromCache), (err) => cb(null, false, err));
    },
    watchTeams(uid, cb) {
      return watchOwned('teams', uid, (list) => cb(sortTeams(list)), (err) => cb(null, err));
    },
    saveTeam(id, data) {
      return pending.track(F.setDoc(F.doc(db, 'teams', id), owned(data), { merge: true }));
    },
    watchClubs(uid, cb) {
      return watchOwned('clubs', uid, (list) => cb(sortClubs(list)), (err) => cb(null, err));
    },
    saveClub(id, data) {
      return pending.track(F.setDoc(F.doc(db, 'clubs', id), owned(data), { merge: true }));
    },
    watchCompetitions(uid, cb) {
      return watchOwned('competitions', uid, (list) => cb(sortClubs(list)), (err) => cb(null, err));
    },
    saveCompetition(id, data) {
      return pending.track(F.setDoc(F.doc(db, 'competitions', id), owned(data), { merge: true }));
    },
    async loadGame(id) {
      const gs = await once(F.doc(db, 'games', id));
      if (!gs.exists()) throw new Error('No se encontró el partido.');
      const es = await once(F.collection(db, 'games', id, 'events'));
      return { game: { id, ...gs.data() }, events: sortEvents(es.docs.map((d) => d.data())) };
    },
    saveGame(id, data) {
      return pending.track(F.setDoc(F.doc(db, 'games', id), owned(data), { merge: true }));
    },
    putEvent(gameId, ev) {
      const data = clean({ ...ev, ownerUid: current.uid, author: current.email, deleted: false, updatedAt: Date.now() });
      return pending.track(F.setDoc(F.doc(db, 'games', gameId, 'events', ev.id), data));
    },
    deleteEvent(gameId, ev) {
      return pending.track(F.setDoc(F.doc(db, 'games', gameId, 'events', ev.id),
        { ownerUid: current.uid, deleted: true, rev: (ev.rev || 1) + 1, updatedAt: Date.now() }, { merge: true }));
    },
    /**
     * Toma el bloqueo del partido para `holder` ({id, label}). Si otro lo tiene y no venció, devuelve
     * {ok: false, holder}. Sin conexión no se puede verificar: devuelve {ok: true, offline: true}.
     */
    async claimGame(gameId, holder, { force = false, ttlMs }) {
      const ref = F.doc(db, 'games', gameId);
      const attempt = F.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return { ok: true }; // partido nuevo todavía sin guardar en el servidor
        const lock = snap.data().lock;
        const now = Date.now();
        if (!force && lock && lock.id !== holder.id && now - (lock.at || 0) < ttlMs) return { ok: false, holder: lock };
        tx.set(ref, { ownerUid: current.uid, lock: { id: holder.id, label: holder.label, at: now } }, { merge: true });
        return { ok: true };
      });
      const timeout = new Promise((resolve) => setTimeout(() => resolve({ ok: true, offline: true }), CLAIM_TIMEOUT_MS));
      return Promise.race([attempt, timeout]).catch(() => ({ ok: true, offline: true }));
    },
    async releaseGame(gameId, holderId) {
      const ref = F.doc(db, 'games', gameId);
      try {
        await F.runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (snap.exists() && snap.data().lock && snap.data().lock.id === holderId) tx.update(ref, { lock: F.deleteField() });
        });
      } catch (e) { /* sin conexión: el bloqueo vence solo */ }
    },
    /** cb(lock|null) cada vez que cambia el documento del partido. */
    watchGameLock(gameId, cb) {
      return F.onSnapshot(F.doc(db, 'games', gameId), (snap) => cb(snap.exists() ? snap.data().lock || null : null), () => {});
    },
    onPending(cb) { return pending.on(cb); }
  };
}
