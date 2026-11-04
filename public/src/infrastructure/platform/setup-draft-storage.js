// Borrador de la previa del partido, por usuario, en localStorage de este dispositivo.

const key = (uid) => 'pb-setup-' + (uid || 'x');

export function loadSetupDraft(uid) {
  try { return JSON.parse(localStorage.getItem(key(uid)) || 'null'); } catch (e) { return null; }
}

export function saveSetupDraft(uid, setup) {
  try { localStorage.setItem(key(uid), JSON.stringify(setup)); } catch (e) { /* sin almacenamiento */ }
}

export function clearSetupDraft(uid) {
  try { localStorage.removeItem(key(uid)); } catch (e) { /* sin almacenamiento */ }
}
