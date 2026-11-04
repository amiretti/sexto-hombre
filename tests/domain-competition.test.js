import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompetitionDocument, blankCompetitionDraft, competitionLabel, sortCompetitions, planCompetitionMigration
} from '../public/src/domain/competition.js';
import { migrateLegacyCompetitions } from '../public/src/application/legacy-migration.js';

const NOV_2026 = Date.UTC(2026, 10, 4);

test('blank draft uses the current season', () => {
  assert.equal(blankCompetitionDraft(NOV_2026).season, '2026');
  assert.equal(blankCompetitionDraft(NOV_2026).periodMin, '10');
});

test('buildCompetitionDocument validation and output', () => {
  const d = (extra) => ({ id: 'k1', name: ' Liga del Oeste ', season: '2026', periodMin: '12', ...extra });
  assert.equal(buildCompetitionDocument(d({ name: ' ' })).error, 'Falta el nombre de la competición.');
  assert.equal(buildCompetitionDocument(d({ season: '26' })).error, 'La temporada va como año (2026) o 2026/27.');
  assert.equal(buildCompetitionDocument(d(), [{ id: 'k2', name: 'liga del oeste', season: '2026' }]).error, 'Ya tenés «Liga del Oeste 2026».');
  assert.equal(buildCompetitionDocument(d(), [{ id: 'k2', name: 'Liga del Oeste', season: '2025' }]).error, undefined);
  assert.equal(buildCompetitionDocument(d(), [{ id: 'k2', name: 'Liga del Oeste', season: '2026', deleted: true }]).error, undefined);
  assert.equal(buildCompetitionDocument(d({ season: '2026/27' })).error, undefined);
  assert.deepEqual(buildCompetitionDocument(d({ isNew: true, periodMin: '99' }), [], 3).doc, { name: 'Liga del Oeste', season: '2026', periodMin: '10', createdAt: 3 });
});

test('label and order', () => {
  assert.equal(competitionLabel({ name: 'Liga', season: '2026' }), 'Liga 2026');
  assert.equal(competitionLabel({ name: 'Liga', season: '' }), 'Liga');
  assert.equal(competitionLabel(null), '');
  const list = [{ id: 'a', name: 'B', season: '2025' }, { id: 'b', name: 'A', season: '2026' }, { id: 'c', name: 'C', season: '2026' }, { id: 'd', name: 'X', deleted: true }];
  assert.deepEqual(sortCompetitions(list).map((c) => c.id), ['b', 'c', 'a']);
});

test('migration: competition text of older teams becomes an entity', () => {
  let n = 0;
  const teams = [
    { id: 't1', competition: 'Liga del Oeste', periodMin: '8' },
    { id: 't2', competition: ' liga del oeste ' },
    { id: 't3', competition: 'Torneo Federal' },
    { id: 't4' }
  ];
  const plan = planCompetitionMigration(teams, [{ id: 'k-fed', name: 'Torneo Federal', season: '2025' }], () => 'k' + ++n, NOV_2026);
  assert.deepEqual(plan.competitions, [{ id: 'k1', doc: { name: 'Liga del Oeste', season: '2026', periodMin: '8', createdAt: NOV_2026 } }]);
  assert.deepEqual(plan.teams, [
    { id: 't1', patch: { competition: '', lastCompetitionId: 'k1' } },
    { id: 't2', patch: { competition: '', lastCompetitionId: 'k1' } },
    { id: 't3', patch: { competition: '', lastCompetitionId: 'k-fed' } }
  ]);
});

test('migrateLegacyCompetitions saves once per team and waits for the list', () => {
  const saved = [];
  const store = { saveCompetition: (id) => { saved.push('c:' + id); return Promise.resolve(); }, saveTeam: (id) => { saved.push('t:' + id); return Promise.resolve(); } };
  const done = new Set();
  const teams = [{ id: 't1', competition: 'Liga' }];
  assert.equal(migrateLegacyCompetitions(store, teams, null, done).teams.length, 0);
  migrateLegacyCompetitions(store, teams, [], done);
  migrateLegacyCompetitions(store, teams, [], done);
  assert.equal(saved.filter((x) => x === 't:t1').length, 1);
  assert.equal(saved.filter((x) => x.startsWith('c:')).length, 1);
});
