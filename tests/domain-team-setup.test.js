import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTeamDocument, activePlayers, seedTeamDraft, editableTeamDraft, normalizeCategory, categoryLabel } from '../public/src/domain/team.js';
import {
  createGame, applyTeamToSetup, reconcileSelection, toggleCalled, toggleStarter, blankSetup, selectedVenue, kitOf, chooseKit, chooseCompetition
} from '../public/src/domain/game-setup.js';

const draft = (players, extra = {}) => ({ id: 't1', clubId: 'c1', category: ' Primera ', coach: ' DT ', competition: '', periodMin: '12', players, ...extra });
const p = (id, num, name = 'X', active = true) => ({ id, num, name, active });

test('buildTeamDocument validation', () => {
  assert.equal(buildTeamDocument(draft([p('a', '1')], { clubId: null })).error, 'Elegí el club del plantel.');
  assert.equal(buildTeamDocument(draft([p('a', '1')], { category: ' ' })).error, 'Elegí la categoría.');
  assert.equal(buildTeamDocument(draft([p('a', '1')]), [{ id: 'otro', clubId: 'c1', category: 'primera' }]).error, 'Ese club ya tiene un plantel Primera Masculino.');
  assert.equal(buildTeamDocument(draft([p('a', '1')], { branch: 'f' }), [{ id: 'otro', clubId: 'c1', category: 'Primera', branch: 'm' }]).error, undefined);
  assert.equal(buildTeamDocument(draft([p('a', '1')]), [{ id: 'otro', clubId: 'c2', category: 'Primera' }, { id: 't1', clubId: 'c1', category: 'Primera' }]).error, undefined);
  assert.equal(buildTeamDocument(draft([{ id: 'a', num: '', name: '' }])).error, 'Cargá al menos un jugador.');
  assert.equal(buildTeamDocument(draft([p('a', 'x')])).error, 'Cada jugador necesita un número (0 a 99).');
  assert.equal(buildTeamDocument(draft([p('a', '7'), p('b', '7')])).error, 'El número 7 está repetido entre los jugadores activos.');
  assert.equal(buildTeamDocument(draft([p('a', '7'), p('b', '7', 'Y', false)])).error, undefined);
});

test('buildTeamDocument output', () => {
  const { doc } = buildTeamDocument(draft([p('a', ' 7 ', ' Ana '), { id: 'b', num: '', name: '' }], { isNew: true }), [], 99);
  assert.deepEqual(doc, {
    clubId: 'c1', category: 'Primera', branch: 'm', coach: 'DT', competition: '', periodMin: '12', createdAt: 99,
    players: [{ id: 'a', num: '7', name: 'Ana', active: true }]
  });
});

test('team helpers', () => {
  assert.equal(activePlayers({ players: [p('a', '1'), p('b', '2', 'X', false)] }).length, 1);
  assert.equal(activePlayers(null).length, 0);
  assert.equal(seedTeamDraft(null, true, 'c1').seeded, 'example');
  assert.equal(seedTeamDraft(null, true, 'c1').clubId, 'c1');
  assert.equal(seedTeamDraft(null, false).seeded, undefined);
  assert.equal(seedTeamDraft({ lastSetup: { team: 'Viejo', players: [{ num: '3', name: 'Z' }] } }, true).category, 'Primera');
  assert.deepEqual(editableTeamDraft({ id: 't', category: 'U17 Femenino', players: [] }).branch, 'f');
  const saved = { id: 't', players: [] };
  editableTeamDraft(saved).players.push(1);
  assert.equal(saved.players.length, 0);
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

test('default venue of the club is proposed at home and can be changed', () => {
  const venues = [{ id: 'v1', name: 'Principal', location: 'A' }, { id: 'v2', name: 'Auxiliar', location: 'B' }];
  const t = { ...team, venues, defaultVenueId: 'v2' };
  const s = blankSetup();
  applyTeamToSetup(s, t);
  assert.equal(s.venueId, 'v2');
  s.venueId = 'v1';               // se cambia para este partido
  reconcileSelection(s, t);
  assert.equal(s.venueId, 'v1');  // y no se pisa con el por defecto
});

test('kit: titular or alternativa of the club', () => {
  const t = { ...team, color: '#111111', altColor: '#ffffff' };
  const s = blankSetup();
  applyTeamToSetup(s, t);
  assert.equal(kitOf(s, t), 'main');
  chooseKit(s, t, 'alt');
  assert.equal(s.teamColor, '#ffffff');
  assert.equal(kitOf(s, t), 'alt');
  s.teamColor = '#16834a';
  assert.equal(kitOf(s, t), null);
  chooseKit(s, { ...t, altColor: '' }, 'alt');
  assert.equal(s.teamColor, '#16834a'); // sin alternativa no cambia
});

test('createGame keeps club and category', () => {
  const t = { ...team, clubId: 'c1', category: 'U17' };
  const s = blankSetup();
  applyTeamToSetup(s, t);
  s.opponent = 'Norte';
  ['c', 'd', 'e'].forEach((id) => { s.sel[id].starter = true; });
  const { game } = createGame(s, t);
  assert.equal(game.team, 'Unión');
  assert.equal(game.category, 'U17 Masculino');
  assert.equal(game.branch, 'm');
  assert.equal(game.competition, '');
  assert.equal(game.competitionId, null);
  assert.equal(game.clubId, 'c1');
});

test('categories: free text of older versions is read as category + branch', () => {
  const n = (category, branch) => normalizeCategory({ category, branch });
  assert.deepEqual(n('U17 Femenino'), { category: 'U17', branch: 'f' });
  assert.deepEqual(n('primera'), { category: 'Primera', branch: 'm' });
  assert.deepEqual(n('Fem U15'), { category: 'U15', branch: 'f' });
  assert.deepEqual(n('Maxi mixto'), { category: 'Maxi', branch: 'x' });
  assert.deepEqual(n('Femenino'), { category: 'Primera', branch: 'f' });
  assert.deepEqual(n('Primera 2'), { category: 'Primera 2', branch: 'm' }); // fuera de la lista: se conserva
  assert.deepEqual(n('U17', 'f'), { category: 'U17', branch: 'f' });
  assert.equal(categoryLabel({ category: 'U17', branch: 'f' }), 'U17 Femenino');
  assert.equal(categoryLabel({ category: 'U17', branch: 'f' }, true), 'U17 Fem.');
  assert.equal(categoryLabel({}), '');
});

test('competition: last used is proposed with its period length; amistoso keeps the team length', () => {
  const comps = [{ id: 'k1', name: 'Liga', season: '2026', periodMin: '12' }];
  const t = { ...team, lastCompetitionId: 'k1' };
  const s = blankSetup();
  applyTeamToSetup(s, t, comps);
  assert.equal(s.competitionId, 'k1');
  assert.equal(s.periodMin, '12');
  chooseCompetition(s, null, t);
  assert.equal(s.competitionId, null);
  assert.equal(s.periodMin, '8');
  applyTeamToSetup(s, { ...t, lastCompetitionId: 'gone' }, comps);
  assert.equal(s.competitionId, null);
  s.opponent = 'Norte';
  ['c', 'd', 'e'].forEach((id) => { s.sel[id].starter = true; });
  const { game } = createGame(s, t, 1, comps[0]);
  assert.equal(game.competitionId, 'k1');
  assert.equal(game.competition, 'Liga 2026');
});
