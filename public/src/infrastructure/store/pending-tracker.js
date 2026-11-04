// Contador de escrituras sin confirmar, compartido por ambas implementaciones del store.

export function createPendingTracker() {
  let n = 0;
  const subs = new Set();
  const emit = () => subs.forEach((cb) => { try { cb(n); } catch (e) { /* un suscriptor roto no frena al resto */ } });
  return {
    track(promise) {
      n++; emit();
      return Promise.resolve(promise).finally(() => { n = Math.max(0, n - 1); emit(); });
    },
    on(cb) { subs.add(cb); cb(n); return () => subs.delete(cb); }
  };
}
