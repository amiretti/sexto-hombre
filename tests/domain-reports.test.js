import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneAt, normalizeShot, buildShotChart, CHART_ZONES, ZONE_SHAPES, ZONE_LABEL_AT } from '../public/src/domain/shot-chart.js';
import { playerSeries, playersInGames, progressStat, PROGRESS_STATS } from '../public/src/domain/player-progress.js';
import { filterReportGames, createReportLoader } from '../public/src/application/report-games.js';
import { buildGameReport } from '../public/src/application/game-report.js';

const roster = [{ id: 'a', num: '4', name: 'Ana' }, { id: 'b', num: '7', name: 'Bea' }];
const game = (over) => ({ id: 'g', teamId: 't1', date: '2026-10-01', opponent: 'Rival', period: 1, attackFirstHalf: 'left', roster, events: [], oppP: {}, ...over });
const shot = (type, x, y, who = 'a', period = 1) => ({ type, x, y, who, period, t: 0 });

test('zones: rim, paint, mid-range sides, corner and wing threes, backcourt', () => {
  assert.equal(zoneAt(180, 760), 'rim');
  assert.equal(zoneAt(500, 750), 'paint');
  assert.equal(zoneAt(700, 750), 'mid-c');
  assert.equal(zoneAt(450, 1150), 'mid-lw');
  assert.equal(zoneAt(200, 1250), 'mid-lb');
  assert.equal(zoneAt(200, 250), 'mid-rb');
  assert.equal(zoneAt(100, 1460), 'c3-l');
  assert.equal(zoneAt(100, 40), 'c3-r');
  assert.equal(zoneAt(950, 750), 't3-c');
  assert.equal(zoneAt(700, 1350), 'w3-l');
  assert.equal(zoneAt(700, 150), 'w3-r');
  assert.equal(zoneAt(1800, 750), 'back');
});

test('every drawable zone has a shape and a label anchor', () => {
  const drawn = CHART_ZONES.filter((z) => z.id !== 'back').map((z) => z.id).sort();
  assert.deepEqual(ZONE_SHAPES.map((s) => s.id).sort(), drawn);
  assert.deepEqual(Object.keys(ZONE_LABEL_AT).sort(), drawn);
});

test('normalize rotates (not mirrors) shots at the right hoop, by period', () => {
  const g = game({ attackFirstHalf: 'right' });
  // 1er cuarto atacando a la derecha: esquina de abajo a la derecha = esquina izquierda del tirador.
  assert.deepEqual(normalizeShot(g, shot('3M', 2700, 1460)), { x: 100, y: 40 });
  // 3er cuarto se cambia de aro: se atacan el de la izquierda.
  assert.deepEqual(normalizeShot(g, shot('3M', 100, 1460, 'a', 3)), { x: 100, y: 1460 });
  // Sin dirección cargada se usa el aro más cercano.
  assert.deepEqual(normalizeShot(game({ attackFirstHalf: null }), shot('2M', 2600, 750)), { x: 200, y: 750 });
  assert.equal(normalizeShot(g, shot('2M', null, null)), null);
});

test('shot chart aggregates zones, shares, efficiency and unlocated shots', () => {
  const g = game({
    events: [
      shot('2M', 180, 750), shot('2X', 190, 760), shot('2M', 170, 740),
      shot('3X', 950, 750), shot('3M', 950, 760, 'b'),
      shot('2X', null, null),
      { type: 'FT', att: 2, made: 2, who: 'a', period: 1, x: null, y: null },
      { type: 'RO', who: 'a', period: 1, x: 200, y: 750 }
    ]
  });
  const c = buildShotChart([g]);
  assert.deepEqual(c.total, { att: 6, made: 3 });
  assert.equal(c.unlocated, 1);
  const rim = c.zones.find((z) => z.id === 'rim');
  assert.equal(rim.att, 3); assert.equal(rim.made, 2);
  assert.ok(Math.abs(rim.share - 3 / 5) < 1e-9);
  assert.ok(Math.abs(rim.pps - 4 / 3) < 1e-9);
  const top = c.zones.find((z) => z.id === 't3-c');
  assert.equal(top.pps, 1.5);
  const onlyA = buildShotChart([g], { playerId: 'a' });
  assert.deepEqual(onlyA.total, { att: 5, made: 2 });
  assert.equal(c.zones.find((z) => z.id === 'paint').pct, null);
});

test('player series: one point per called-up game, chronological, with average', () => {
  const g1 = game({ id: 'g1', date: '2026-10-08', events: [shot('2M', 180, 750), shot('3M', 950, 750)] });
  const g2 = game({ id: 'g2', date: '2026-10-01', events: [shot('2X', 180, 750)] });
  const g3 = game({ id: 'g3', date: '2026-10-15', roster: [roster[1]], events: [] });
  const s = playerSeries([g1, g2, g3], 'a', 'pts');
  assert.deepEqual(s.points.map((p) => [p.gameId, p.value]), [['g2', 0], ['g1', 5]]);
  assert.equal(s.average, 2.5);
  const fg = playerSeries([g1, g2], 'a', 'fg');
  assert.deepEqual(fg.points.map((p) => [p.value, p.detail]), [[0, '0/1'], [100, '2/2']]);
  const ft = playerSeries([g1], 'a', 'ft');
  assert.equal(ft.points[0].value, null);
  assert.equal(ft.average, null);
  const team = playerSeries([g1, g2, g3], null, 'pts');
  assert.deepEqual(team.points.map((p) => p.value), [0, 5, 0]);
});

test('every progress stat works for players and team totals', () => {
  const g = game({ events: [shot('2M', 180, 750), { type: 'TOV', who: 'a', period: 1 }, { type: 'PF', who: 'a', period: 1, sub: 'none' }] });
  for (const st of PROGRESS_STATS) {
    const p = playerSeries([g], 'a', st.id).points[0].value;
    const t = playerSeries([g], null, st.id).points[0].value;
    assert.ok(p === null || typeof p === 'number', st.id);
    assert.ok(t === null || typeof t === 'number', st.id);
  }
  assert.equal(progressStat('nope').id, 'pts');
});

test('players in games keep the latest number and name, ordered by number', () => {
  const old = game({ date: '2026-01-01', roster: [{ id: 'a', num: '9', name: 'Ana V.' }] });
  const list = playersInGames([game({}), old]);
  assert.deepEqual(list.map((p) => [p.id, p.num, p.games]), [['a', '4', 2], ['b', '7', 1]]);
});

test('report filters: team, competition, friendlies and date range', () => {
  const list = [
    { id: '1', teamId: 't1', competitionId: 'c1', date: '2026-03-01' },
    { id: '2', teamId: 't1', competitionId: '', date: '2026-05-01' },
    { id: '3', teamId: 't2', competitionId: 'c1', date: '2026-05-01' },
    { id: '4', teamId: 't1', competitionId: 'c1', date: '2026-08-01', deleted: true }
  ];
  const ids = (f) => filterReportGames(list, f).map((g) => g.id);
  assert.deepEqual(ids({ teamId: 't1' }), ['1', '2']);
  assert.deepEqual(ids({ teamId: 't1', competitionId: 'c1' }), ['1']);
  assert.deepEqual(ids({ teamId: 't1', competitionId: 'none' }), ['2']);
  assert.deepEqual(ids({ teamId: 't1', from: '2026-04-01' }), ['2']);
  assert.deepEqual(ids({ teamId: 't1', to: '2026-04-01' }), ['1']);
});

test('report loader caches games until they change and skips failures', async () => {
  let calls = 0;
  const store = {
    loadGame: async (id) => {
      calls++;
      if (id === 'bad') throw new Error('x');
      return { game: { id, teamId: 't1' }, events: [{ seq: 1, type: '2M' }] };
    }
  };
  const loader = createReportLoader(store);
  const first = await loader.load([{ id: 'g1', updatedAt: 1 }, { id: 'bad' }]);
  assert.equal(first.length, 1);
  assert.equal(first[0].events.length, 1);
  await loader.load([{ id: 'g1', updatedAt: 1 }]);
  assert.equal(calls, 2);
  await loader.load([{ id: 'g1', updatedAt: 2 }]);
  assert.equal(calls, 3);
});

test('game report carries the shot chart for the PDF', () => {
  const g = game({ team: 'Unión', clock: { running: false, ms: 0 }, status: 'final', events: [shot('2M', 180, 750), shot('3X', 950, 750), shot('2X', null, null)] });
  const r = buildGameReport(g);
  assert.equal(r.shotChart.att, 3);
  assert.equal(r.shotChart.shots.length, 2);
  assert.equal(r.shotChart.unlocated, 1);
  assert.equal(r.shotChart.total, '1/3 (33%)');
  assert.deepEqual(r.shotChart.zones.map((z) => z.label), ['Bajo el aro', 'Triple · de frente']);
});
