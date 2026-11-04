// Partidos de prueba.

export const ROSTER = [
  { id: 'p1', num: '4', name: 'Tomás Ferreyra' },
  { id: 'p2', num: '5', name: 'Bruno Acosta' },
  { id: 'p3', num: '7', name: 'Lucas Medina' },
  { id: 'p4', num: '9', name: 'Facundo Ríos' },
  { id: 'p5', num: '11', name: 'Nicolás Vera' },
  { id: 'p6', num: '6', name: 'Joaquín Sosa' },
  { id: 'p7', num: '8', name: 'Ignacio Paz' }
];

let seq = 1;
export function ev(type, who, extra = {}) {
  return { id: 'e' + seq, seq: seq++, period: 1, t: 300, x: null, y: null, who, type, ...extra };
}

export function makeGame(overrides = {}) {
  return {
    id: 'g1', status: 'live', venue: 'home', team: 'Unión Central', opponent: 'Deportivo Norte', coach: 'Raúl Benítez',
    teamColor: '#1d4fc4', oppColor: '#c3372c', competition: 'Liga', date: '2026-11-04', periodMin: 10,
    roster: ROSTER.map((p) => ({ ...p })), starters: ['p1', 'p2', 'p3', 'p4', 'p5'], onCourt: ['p1', 'p2', 'p3', 'p4', 'p5'],
    period: 1, clock: { rem: 600000, running: false, t0: 0 }, events: [], seq: 1, oppP: {},
    ...overrides
  };
}
