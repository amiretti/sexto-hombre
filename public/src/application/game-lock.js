// Caso de uso: un partido se carga desde un solo dispositivo a la vez.
// El dispositivo que lo abre toma el bloqueo y lo renueva; si otro lo toma, este se entera y deja de guardar.

export const LOCK_TTL_MS = 90 * 1000;
const HEARTBEAT_MS = 30 * 1000;
const CLOCK_TOLERANCE_MS = 5 * 1000;

/**
 * @param {object} deps
 * @param {object} deps.store   puerto de datos (claimGame, releaseGame, watchGameLock)
 * @param {{id: string, label: string}} deps.device
 * @param {(holder: object, gameId: string) => void} deps.onLost   otro dispositivo tomó el partido
 */
export function createGameLock({ store, device, onLost, now = () => Date.now() }) {
  let gameId = null, timer = null, unwatch = null;

  function stop() {
    clearInterval(timer); timer = null;
    if (unwatch) unwatch();
    unwatch = null;
    gameId = null;
  }

  function lost(holder) {
    const id = gameId;
    if (!id) return;
    stop();
    onLost(holder || null, id);
  }

  async function heartbeat() {
    if (!gameId) return;
    const r = await store.claimGame(gameId, device, { ttlMs: LOCK_TTL_MS });
    if (!r.ok) lost(r.holder);
  }

  function hold(id) {
    stop();
    gameId = id;
    const since = now() - CLOCK_TOLERANCE_MS;
    timer = setInterval(heartbeat, HEARTBEAT_MS);
    // Solo cuenta un bloqueo tomado después de abrir acá: la caché local puede traer uno viejo de otro dispositivo.
    unwatch = store.watchGameLock(id, (lock) => { if (lock && lock.id !== device.id && (lock.at || 0) >= since) lost(lock); });
  }

  return {
    device,
    /** Intenta tomar el partido. {ok: true} o {ok: false, holder}. `force` lo toma aunque otro lo tenga. */
    async acquire(id, force = false) {
      const r = await store.claimGame(id, device, { force, ttlMs: LOCK_TTL_MS });
      if (r.ok) hold(id);
      return r;
    },
    /** Suelta el partido actual (al volver al inicio o cerrar sesión). */
    release() {
      if (!gameId) return;
      const id = gameId;
      stop();
      store.releaseGame(id, device.id);
    },
    /** Revisa el bloqueo ya (por ejemplo, al volver a la app después de tenerla en segundo plano). */
    check: heartbeat
  };
}

/** "hace 20 s" / "hace 3 min" desde `at` (ms). */
export function lockAgeText(at, now = Date.now()) {
  const s = Math.max(0, Math.round((now - (at || now)) / 1000));
  return s < 60 ? 'hace ' + s + ' s' : 'hace ' + Math.round(s / 60) + ' min';
}
