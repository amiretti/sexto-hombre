// Marca de Sexto Hombre en las pantallas.

/** Logo grande (pantallas de ingreso). */
export function brandMark(cls) {
  return '<img class="' + (cls || 'bmark') + '" src="brand/logo.svg" alt="" width="40" height="40">';
}

/** Línea con logo chico y nombre (encabezado del inicio). */
export function brandLine() {
  return '<p class="brandline"><img class="bmark" src="brand/logo-small.svg" alt="" width="32" height="32">' +
    '<span class="bword">SEXTO HOMBRE</span></p>';
}
