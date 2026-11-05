import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClubDocument, editableClubDraft, seedClubDraft, venuesOf, toggleDefaultVenue, resolveTeam, teamLabel, planClubMigration
} from '../public/src/domain/club.js';
import { migrateLegacyTeams } from '../public/src/application/legacy-migration.js';

const club = (extra = {}) => ({ id: 'c1', name: ' Unión ', color: '#111111', altColor: '#ffffff', venues: [], ...extra });
const v = (id, name, location) => ({ id, name, location });

test('buildClubDocument validation', () => {
  assert.equal(buildClubDocument(club({ name: ' ' })).error, 'Falta el nombre del club.');
  assert.equal(buildClubDocument(club(), [{ id: 'c2', name: 'unión' }]).error, 'Ya tenés un club llamado «Unión».');
  assert.equal(buildClubDocument(club(), [{ id: 'c1', name: 'Unión' }]).error, undefined);
  assert.equal(buildClubDocument(club({ venues: [v('v1', 'Estadio', ' ')] })).error, 'Cada estadio necesita nombre y ubicación.');
  assert.equal(buildClubDocument(club({ venues: [v('v1', ' ', 'Calle 1')] })).error, 'Cada estadio necesita nombre y ubicación.');
  assert.equal(buildClubDocument(club({ venues: [v('v1', 'Estadio', 'A'), v('v2', 'estadio ', 'B')] })).error, 'Hay dos estadios llamados «estadio».');
});

test('buildClubDocument output', () => {
  const { doc } = buildClubDocument(club({ isNew: true, color: 'red;x', venues: [v('v1', ' Principal ', ' Calle 1 '), v('v2', '', '')], defaultVenueId: 'v1' }), [], 7);
  assert.deepEqual(doc, {
    name: 'Unión', color: '#1d4fc4', altColor: '#ffffff', createdAt: 7,
    venues: [{ id: 'v1', name: 'Principal', location: 'Calle 1' }], defaultVenueId: 'v1'
  });
});

test('default venue toggles and is dropped if the venue is gone', () => {
  const d = club({ venues: [v('v1', 'Principal', 'A'), v('v2', 'Auxiliar', 'B')] });
  toggleDefaultVenue(d, 'v2');
  assert.equal(buildClubDocument(d).doc.defaultVenueId, 'v2');
  toggleDefaultVenue(d, 'v2');
  assert.equal(d.defaultVenueId, null);
  d.defaultVenueId = 'gone';
  assert.equal(buildClubDocument(d).doc.defaultVenueId, null);
});

test('drafts and seeds', () => {
  const saved = { id: 'c', name: 'X' };
  const d = editableClubDraft(saved);
  assert.equal(d.venues.length, 1);
  assert.equal(d.altColor, '#ffffff');
  assert.equal(saved.venues, undefined);
  assert.equal(seedClubDraft(null, true).defaultVenueId, 'v-principal');
  assert.equal(seedClubDraft({ lastSetup: { team: 'Viejo', teamColor: '#16834a' } }, true).name, 'Viejo');
  assert.equal(seedClubDraft(null, false).name, '');
  assert.deepEqual(venuesOf({ venues: [{ id: 'a', name: 'A' }, { id: 'b', name: ' ' }] }).map((x) => x.id), ['a']);
});

test('resolveTeam takes name, colors and venues from the club', () => {
  const c = { id: 'c1', name: 'Unión', color: '#111111', altColor: '#ffffff', venues: [v('v1', 'P', 'A')], defaultVenueId: 'v1' };
  const t = resolveTeam({ id: 't1', clubId: 'c1', category: 'U17', name: 'viejo', color: '#c3372c', players: [] }, c);
  assert.equal(t.name, 'Unión');
  assert.equal(t.color, '#111111');
  assert.equal(t.altColor, '#ffffff');
  assert.equal(t.defaultVenueId, 'v1');
  assert.equal(teamLabel(t), 'Unión · U17 Masc.');
  // sin club (antes de migrar): sus propios datos
  const legacy = resolveTeam({ id: 't2', name: 'Viejo', color: '#c3372c' }, null);
  assert.equal(legacy.name, 'Viejo');
  assert.equal(legacy.altColor, '');
  assert.equal(teamLabel(legacy), 'Viejo');
});

test('planClubMigration groups old teams by name into clubs', () => {
  let n = 0;
  const ids = () => 'new' + ++n;
  const teams = [
    { id: 'a', name: 'Unión', color: '#111111', venues: [v('v1', 'Estadio', 'A')], defaultVenueId: 'v1' },
    { id: 'b', name: ' unión ', color: '#222222', venues: [v('v2', 'estadio', 'otra'), v('v3', 'Auxiliar', 'B')] },
    { id: 'c', name: 'Norte', color: '#333333' },
    { id: 'd', name: 'Sur' },
    { id: 'e', name: 'Otro', clubId: 'c-sur' },
    { id: 'x', name: 'Borrado', deleted: true }
  ];
  const clubs = [{ id: 'c-sur', name: 'Sur' }];
  const plan = planClubMigration(teams, clubs, ids, 5);
  assert.equal(plan.clubs.length, 2);
  const union = plan.clubs[0];
  assert.equal(union.doc.name, 'Unión');
  assert.equal(union.doc.color, '#111111');
  assert.deepEqual(union.doc.venues.map((x) => x.name), ['Estadio', 'Auxiliar']);
  assert.equal(union.doc.defaultVenueId, 'v1');
  assert.deepEqual(plan.teams, [
    { id: 'a', patch: { clubId: union.id, category: 'Primera' } },
    { id: 'b', patch: { clubId: union.id, category: 'Primera 2' } },
    { id: 'c', patch: { clubId: plan.clubs[1].id, category: 'Primera' } },
    { id: 'd', patch: { clubId: 'c-sur', category: 'Primera' } }
  ]);
});

test('migrateLegacyTeams saves once per team', () => {
  const saved = { clubs: [], teams: [] };
  const store = {
    saveClub: (id, d) => { saved.clubs.push(id); return Promise.resolve(); },
    saveTeam: (id, d) => { saved.teams.push([id, d.category]); return Promise.resolve(); }
  };
  const done = new Set();
  const teams = [{ id: 'a', name: 'Unión' }, { id: 'b', name: 'Unión', clubId: 'c1', category: 'Primera' }];
  migrateLegacyTeams(store, teams, [{ id: 'c1', name: 'Unión' }], done);
  assert.deepEqual(saved, { clubs: [], teams: [['a', 'Primera 2']] });
  migrateLegacyTeams(store, teams, [{ id: 'c1', name: 'Unión' }], done);
  assert.equal(saved.teams.length, 1);
  assert.equal(migrateLegacyTeams(store, [{ id: 'z', name: 'Z' }], null, done).teams.length, 0); // clubes sin leer: espera
});
