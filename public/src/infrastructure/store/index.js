// Puerto de datos. Dos adaptadores con la misma interfaz:
//  - Firebase: login con Google, datos en Firestore con caché persistente (funciona sin red y sincroniza sola).
//  - Demo: sin login, datos en localStorage de este dispositivo.

/**
 * @typedef {object} Store
 * @property {'firebase'|'demo'} mode
 * @property {(cb: (user: object|null) => void) => Function} onAuth   cb cada vez que cambia la sesión
 * @property {() => Promise<void>} signIn
 * @property {() => Promise<void>} signOut
 * @property {(user: object) => Promise<boolean>} isAllowed            lista blanca de correos
 * @property {(uid: string) => Promise<object|null>} getProfile
 * @property {(uid: string, data: object) => Promise<void>} saveProfile
 * @property {(uid: string, cb: (list: object[]|null, fromCache: boolean, err?: any) => void) => Function} watchGames
 * @property {(uid: string, cb: (list: object[]|null, err?: any) => void) => Function} watchTeams
 * @property {(id: string, data: object) => Promise<void>} saveTeam    crea o actualiza (merge)
 * @property {(id: string) => Promise<{game: object, events: object[]}>} loadGame
 * @property {(id: string, data: object) => Promise<void>} saveGame    crea o actualiza (merge)
 * @property {(gameId: string, ev: object) => Promise<void>} putEvent  crea o actualiza una jugada
 * @property {(gameId: string, ev: object) => Promise<void>} deleteEvent borrado lógico (deleted: true)
 * @property {(cb: (n: number) => void) => Function} onPending          escrituras sin confirmar
 */

import { createFirebaseStore } from './firebase-store.js';
import { createDemoStore } from './demo-store.js';

/**
 * firebase-config.js no se versiona (ver firebase-config.example.js).
 * Si no existe, la app arranca en modo demo.
 */
async function loadFirebaseConfig() {
  try {
    const mod = await import('../../../firebase-config.js');
    return mod.firebaseConfig || null;
  } catch (e) {
    return null;
  }
}

/** @returns {Promise<Store>} */
export async function createStore() {
  const forceDemo = /[?&]demo(=1)?(&|$)/.test(location.search);
  if (forceDemo) return createDemoStore();
  const config = await loadFirebaseConfig();
  if (config && config.apiKey) return createFirebaseStore(config);
  return createDemoStore();
}
