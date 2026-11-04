// Cómo se nombra cada cosa del partido (jugadores, jugadas). Texto plano, sin HTML.

import { TURNOVER_KINDS, PERSONAL_FOUL_KINDS, COACH, BENCH } from './catalog.js';

export function findPlayer(game, id) {
  return game.roster.find((p) => p.id === id);
}

/** Apellido (última palabra) o el nombre completo si es una sola palabra. */
export function shortName(name) {
  const n = (name || '').trim();
  if (!n) return '';
  const parts = n.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : n;
}

/** "#7 Medina", "DT · Raúl Benítez", "Banca" o "—". */
export function whoLabel(game, who, long = false) {
  if (who === COACH) return 'DT' + (long && game.coach ? ' · ' + game.coach : '');
  if (who === BENCH) return 'Banca';
  const p = findPlayer(game, who);
  if (!p) return '—';
  return '#' + p.num + ' ' + (long ? p.name : shortName(p.name));
}

/** Detalle secundario de una jugada ("Mal pase", "2 de 3", "Entra … · Sale …"). */
export function eventDetail(game, e) {
  if (e.type === 'TOV') return TURNOVER_KINDS[e.sub] || '';
  if (e.type === 'PF') return PERSONAL_FOUL_KINDS[e.sub] || '';
  if (e.type === 'FT') return e.made + ' de ' + e.att;
  if (e.type === 'SUB') {
    const inn = (e.inn || []).map((i) => whoLabel(game, i)).join(', ');
    const out = (e.out || []).map((i) => whoLabel(game, i)).join(', ');
    return 'Entra ' + inn + ' · Sale ' + out;
  }
  return '';
}

/** Categoría visual de la jugada: score | miss | foul | tech | sub | ''. */
export function eventCategory(e) {
  if (['2M', '3M'].includes(e.type) || (e.type === 'FT' && e.made > 0)) return 'score';
  if (['2X', '3X', 'FT'].includes(e.type)) return 'miss';
  if (e.type === 'PF') return 'foul';
  if (['TF', 'UF', 'DF'].includes(e.type)) return 'tech';
  if (e.type === 'SUB') return 'sub';
  return '';
}
