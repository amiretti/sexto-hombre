// Conversión entre los objetos de la app y lo que se guarda.

/** Copia sin `undefined` ni prototipos (lo que acepta Firestore / JSON). */
export function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Quita los metadatos de almacenamiento de una jugada. */
export function stripMeta(e) {
  const c = { ...e };
  delete c.ownerUid; delete c.author; delete c.deleted; delete c.updatedAt;
  return c;
}

/** Usuario de Firebase Auth → usuario de la app. */
export function userInfo(u) {
  return { uid: u.uid, email: (u.email || '').toLowerCase(), name: u.displayName || u.email || 'Usuario', photo: u.photoURL || '' };
}

/** Partidos visibles, del más reciente al más viejo. */
export function sortGames(list) {
  return list.filter((g) => !g.deleted).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** Clubes visibles, por nombre. */
export function sortClubs(list) {
  return list.filter((c) => !c.deleted).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
}

/** Planteles visibles, por nombre. */
export function sortTeams(list) {
  return list.filter((t) => !t.deleted).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
}

/** Jugadas visibles, en orden de carga. */
export function sortEvents(list) {
  return list.filter((e) => !e.deleted).map(stripMeta).sort((a, b) => (a.seq || 0) - (b.seq || 0));
}
