import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTeamDocument, activePlayers, seedTeamDraft, knownCompetitions, editableTeamDraft, teamVenues, toggleDefaultVenue } from '../public/src/domain/team.js';
import {
  createGame, applyTeamToSetup, reconcileSelection, toggleCalled, toggleStarter, blankSetup, selectedVenue
} from '../public/src/domain/game-setup.js';

const draft = (players, extra = {}) => ({ id: 't1', name: 'Unión', color: '#111111', coach: ' DT ', competition: '', periodMin: '12', players, ...extra });
const p = (id, num, name = 'X', active = true) => ({ id, num, name, active });

test('buildTeamDocument validation', () => {
  assert.equal(buildTeamDocument(draft([p('a', '1')], { name: ' ' })).error, 'Falta el nombre del equipo.');
  assert.equal(buildTeamDocument(draft([{ id: 'a', num: '', name: '' }])).error, 'Cargá al menos un jugador.');
  assert.equal(buildTeamDocument(draft([p('a', 'x')])).error, 'Cada jugador necesita un número (0 a 99).');
  assert.equal(buildTeamDocument(draft([p('a', '7'), p('b', '7')])).error, 'El número 7 está repetido entre los jugadores activos.');
  assert.equal(buildTeamDocument(draft([p('a', '7'), p('b', '7', 'Y', false)])).error, undefined);
});

test('buildTeamDocument output', () => {
  const { doc } = buildTeamDocument(draft([p('a', ' 7 ', ' Ana '), { id: 'b', num: '', name: '' }], { isNew: true }), 99);
  assert.deepEqual(doc, {
    name: 'Unión', color: '#111111', coach: 'DT', competition: '', periodMin: '12', createdAt: 99,
    players: [{ id: 'a', num: '7', name: 'Ana', active: true }], venues: [], defaultVenueId: null
  });
});

test('buildTeamDocument venues', () => {
  const base = [p('a', '7')];
  const v = (id, name, location) => ({ id, name, location });
  assert.equal(buildTeamDocument(draft(base, { venues: [v('v1', 'Estadio', ' ')] })).error, 'Cada estadio necesita nombre y ubicación.');
  assert.equal(buildTeamDocument(draft(base, { venues: [v('v1', ' ', 'Calle 1')] })).error, 'Cada estadio necesita nombre y ubicación.');
  assert.equal(buildTeamDocument(draft(base, { venues: [v('v1', 'Estadio', 'A'), v('v2', 'estadio ', 'B')] })).error, 'Hay dos estadios llamados «estadio».');
  const { doc } = buildTeamDocument(draft(base, { venues: [v('v1', ' Principal ', ' Calle 1 '), v('v2', '', '')] }));
  assert.deepEqual(doc.venues, [{ id: 'v1', name: 'Principal', location: 'Calle 1' }]);
});

test('editableTeamDraft always offers a venue row and does not touch the saved team', () => {
  const saved = { id: 't', name: 'X', players: [] };
  const d = editableTeamDraft(saved);
  assert.equal(d.venues.length, 1);
  assert.equal(saved.venues, undefined);
  assert.deepEqual(teamVenues({ venues: [{ id: 'a', name: 'A' }, { id: 'b', name: ' ' }] }).map((x) => x.id), ['a']);
});

test('team helpers', () => {
  assert.equal(activePlayers({ players: [p('a', '1'), p('b', '2', 'X', false)] }).length, 1);
  assert.equal(activePlayers(null).length, 0);
  assert.equal(seedTeamDraft(null, true).seeded, 'example');
  assert.equal(seedTeamDraft(null, false).seeded, undefined);
  assert.equal(seedTeamDraft({ lastSetup: { team: 'Viejo', players: [{ num: '3', name: 'Z' }] } }, true).name, 'Viejo');
  assert.deepEqual(knownCompetitions([{ competition: 'B' }], [{ competition: 'A' }, { competition: 'B' }, {}]), ['A', 'B']);
});

const team = {
  id: 't1', name: 'Unión', color: '#111111', coach: 'DT', competition: 'Liga', periodMin: '8', lastStarters: ['a', 'b'],
  players: ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => p(id, String(i + 1), 'J ' + id)).concat([p('z', '99', 'Baja', false)])
};

test('setup selection', () => {
  const s = blankSetup();
  applyTeamToSetup(s, team);
  assert.equal(s.periodMin, '8');
  assert.deepEqual(s.sel.a, { in: true, starter: true });
  assert.deepEqual(s.sel.c, { in: true, starter: false });
  assert.equal(s.sel.z, undefined);
  toggleCalled(s, 'a');
  assert.deepEqual(s.sel.a, { in: false, starter: false });
  assert.equal(toggleStarter(s, 'a'), false);
  assert.equal(toggleStarter(s, 'c'), true);
  s.sel.gone = { in: true };
  delete s.sel.f;
  reconcileSelection(s, team);
  assert.equal(s.sel.gone, undefined);
  assert.deepEqual(s.sel.f, { in: true, starter: false });
});

test('createGame validation and result', () => {
  const s = blankSetup();
  assert.equal(createGame(s, null).error, 'Elegí el plantel.');
  applyTeamToSetup(s, team);
  assert.equal(createGame(s, team).error, 'Falta el nombre del rival.');
  s.opponent = ' Norte ';
  ['b', 'c', 'd', 'e', 'f'].forEach((id) => { s.sel[id].in = false; });
  assert.equal(createGame(s, team).error, 'Convocá al menos 5 jugadores.');
  ['b', 'c', 'd', 'e', 'f'].forEach((id) => { s.sel[id].in = true; });
  assert.equal(createGame(s, team).error, 'Elegí exactamente 5 titulares.');
  ['c', 'd', 'e'].forEach((id) => { s.sel[id].starter = true; });
  const dup = { ...team, players: team.players.map((x) => (x.id === 'f' ? { ...x, num: '1' } : x)) };
  assert.equal(createGame(s, dup).error, 'El número 1 está repetido. Corregilo en el plantel.');
  const { game, starters } = createGame({ ...s, venue: 'away' }, team, 5);
  assert.deepEqual(starters, ['a', 'b', 'c', 'd', 'e']);
  assert.equal(game.opponent, 'Norte');
  assert.equal(game.venue, 'away');
  assert.equal(game.periodMin, 8);
  assert.deepEqual(game.clock, { rem: 480000, running: false, t0: 0 });
  assert.deepEqual(game.onCourt, starters);
  assert.equal(game.roster.length, 6);
  assert.equal(game.createdAt, 5);
});

test('createGame: stadium when playing at home', () => {
  const ready = (t) => {
    const s = blankSetup();
    applyTeamToSetup(s, t);
    s.opponent = 'Norte';
    ['c', 'd', 'e'].forEach((id) => { s.sel[id].starter = true; });
    return s;
  };
  // sin estadios cargados: se juega igual, sin estadio
  assert.equal(createGame(ready(team), team).game.stadium, undefined);
  // un solo estadio: queda elegido solo
  const one = { ...team, venues: [{ id: 'v1', name: 'Principal', location: 'Calle 1' }] };
  const s1 = ready(one);
  assert.equal(s1.venueId, 'v1');
  assert.deepEqual(createGame(s1, one).game.stadium, { name: 'Principal', location: 'Calle 1' });
  // varios: hay que elegir
  const two = { ...team, venues: [{ id: 'v1', name: 'Principal', location: 'Calle 1' }, { id: 'v2', name: 'Auxiliar', location: 'Calle 2' }] };
  const s2 = ready(two);
  assert.equal(s2.venueId, null);
  assert.equal(createGame(s2, two).error, 'Elegí en qué estadio se juega.');
  s2.venueId = 'v2';
  assert.equal(selectedVenue(s2, two).name, 'Auxiliar');
  assert.deepEqual(createGame(s2, two).game.stadium, { name: 'Auxiliar', location: 'Calle 2' });
  // de visitante no se pide ni se guarda
  assert.equal(createGame({ ...s2, venueId: null, venue: 'away' }, two).game.stadium, undefined);
  // si el estadio elegido se borró del plantel, se vuelve a elegir
  const s3 = { ...s2, venueId: 'gone' };
  reconcileSelection(s3, two);
  assert.equal(s3.venueId, null);
  reconcileSelection(s3, one);
  assert.equal(s3.venueId, 'v1');
});

test('default venue: kept only if it exists, proposed at home, can be changed', () => {
  const d = draft([p('a', '7')], { venues: [{ id: 'v1', name: 'Principal', location: 'A' }, { id: 'v2', name: 'Auxiliar', location: 'B' }] });
  toggleDefaultVenue(d, 'v2');
  assert.equal(buildTeamDocument(d).doc.defaultVenueId, 'v2');
  toggleDefaultVenue(d, 'v2');
  assert.equal(d.defaultVenueId, null);
  d.defaultVenueId = 'gone';
  assert.equal(buildTeamDocument(d).doc.defaultVenueId, null);

  const t = { ...team, venues: d.venues, defaultVenueId: 'v2' };
  const s = blankSetup();
  applyTeamToSetup(s, t);
  assert.equal(s.venueId, 'v2');
  s.venueId = 'v1';               // se cambia para este partido
  reconcileSelection(s, t);
  assert.equal(s.venueId, 'v1');  // y no se pisa con el por defecto
  assert.equal(seedTeamDraft(null, true).defaultVenueId, 'v-principal');
});
