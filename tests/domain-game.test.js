import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hydrateGame, gameDocument, adjustOpponentScore, applySubstitution, applyForcedSubstitution, advancePeriod, tickClock,
  setClockManually, finishGame, applyEditDraft, normalizeEditDraft, newEditDraft, playConsequences, pendingForcedExit,
  removeEvent, lastLoggedEvent, appendEvent, playBlockReason, buildPlayEvent, benchCandidates
} from '../public/src/domain/game.js';
import { teamFouls, playerStats } from '../public/src/domain/stats.js';
import { makeGame, ev } from './fixtures.js';

const fouls = (who, n, extra) => Array.from({ length: n }, () => ev('PF', who, extra));

test('hydrateGame fills defaults and next seq', () => {
  const g = hydrateGame({ id: 'g', seq: 2 }, [{ seq: 7 }, { seq: 3 }]);
  assert.deepEqual(g.oppP, {});
  assert.equal(g.status, 'live');
  assert.equal(g.seq, 8);
});

test('gameDocument drops events/id and adds summary', () => {
  const doc = gameDocument(makeGame({ events: [ev('2M', 'p1')], oppP: { 1: 3 } }));
  assert.equal(doc.events, undefined);
  assert.equal(doc.id, undefined);
  assert.deepEqual(doc.summary, { us: 2, them: 3 });
});

test('adjustOpponentScore', () => {
  const g = makeGame({ period: 3, oppP: { 1: 2 } });
  adjustOpponentScore(g, 3);
  assert.deepEqual(g.oppP, { 1: 2, 3: 3 });
  adjustOpponentScore(g, -1);
  assert.deepEqual(g.oppP, { 1: 2, 3: 2 });
  const h = makeGame({ period: 3, oppP: { 1: 2, 2: 1 } });
  adjustOpponentScore(h, -1); // el actual no tiene puntos: descuenta del último que tenga
  assert.deepEqual(h.oppP, { 1: 2, 2: 0 });
  const empty = makeGame();
  adjustOpponentScore(empty, -1);
  assert.deepEqual(empty.oppP, {});
});

test('applySubstitution', () => {
  const g = makeGame();
  assert.equal(applySubstitution(g, ['p1', 'p2']), null);
  const r = applySubstitution(g, ['p6', 'p2', 'p3', 'p4', 'p5']);
  assert.deepEqual(r, { inn: ['p6'], out: ['p1'] });
  assert.deepEqual(g.onCourt, ['p2', 'p3', 'p4', 'p5', 'p6']); // orden del plantel
});

test('applyForcedSubstitution and bench candidates', () => {
  const g = makeGame({ events: fouls('p7', 5) });
  assert.deepEqual(benchCandidates(g).map((p) => p.id), ['p6']);
  assert.deepEqual(applyForcedSubstitution(g, 'p2', 'p6'), { inn: ['p6'], out: ['p2'] });
  assert.deepEqual(g.onCourt, ['p1', 'p6', 'p3', 'p4', 'p5']);
  applyForcedSubstitution(g, 'p1', null);
  assert.deepEqual(g.onCourt, ['p6', 'p3', 'p4', 'p5']);
});

test('advancePeriod', () => {
  const g = makeGame({ period: 1, periodMin: 10 });
  assert.equal(advancePeriod(g), true);
  assert.equal(g.period, 2);
  assert.deepEqual(g.clock, { rem: 600000, running: false, t0: 0 });
  const decided = makeGame({ period: 4, events: [ev('2M', 'p1')] });
  assert.equal(advancePeriod(decided), false);
  const tied = makeGame({ period: 4, status: 'final' });
  assert.equal(advancePeriod(tied), true);
  assert.equal(tied.period, 5);
  assert.equal(tied.status, 'live');
  assert.equal(tied.clock.rem, 300000);
});

test('tickClock', () => {
  const g = makeGame({ clock: { rem: 1000, running: true, t0: 0 } });
  assert.equal(tickClock(g, 500), 'running');
  assert.equal(tickClock(g, 2000), 'period-end');
  assert.deepEqual([g.clock.rem, g.clock.running], [0, false]);
  const last = makeGame({ period: 4, clock: { rem: 1000, running: true, t0: 0 }, events: [ev('2M', 'p1')] });
  assert.equal(tickClock(last, 2000), 'final');
  assert.equal(last.status, 'final');
  assert.equal(last.endedAt, 2000);
  const tie = makeGame({ period: 4, clock: { rem: 1000, running: true, t0: 0 } });
  assert.equal(tickClock(tie, 2000), 'period-end');
});

test('setClockManually and finishGame', () => {
  const g = makeGame({ status: 'final', period: 4 });
  setClockManually(g, 2, 15, 0);
  assert.equal(g.period, 2);
  assert.equal(g.clock.rem, 600000); // tope
  assert.equal(g.status, 'live');
  const h = makeGame({ status: 'final', period: 4 });
  setClockManually(h, 4, 0, 0);
  assert.equal(h.status, 'final');
  const f = makeGame({ clock: { rem: 5000, running: true, t0: 0 } });
  finishGame(f, 1000);
  assert.deepEqual([f.status, f.endedAt, f.clock.rem, f.clock.running], ['final', 1000, 4000, false]);
});

test('edit draft normalize and apply', () => {
  const g = makeGame();
  const e = ev('TOV', 'p1', { sub: 'pase', t: 100 });
  const d = newEditDraft(e);
  assert.equal(d.timeStr, '1:40');
  d.who = 'coach'; normalizeEditDraft(d);
  assert.equal(d.type, 'TF');
  const d2 = { ...d, who: 'p1', type: 'PF', sub: 'pase' }; normalizeEditDraft(d2);
  assert.equal(d2.sub, 'none');
  const d3 = { ...d, who: 'p1', type: 'FT', att: 2, made: 3 }; normalizeEditDraft(d3);
  assert.equal(d3.made, 2);
  assert.match(applyEditDraft(g, e, { ...d3, timeStr: '11:00' }), /Tiempo inválido.*10:00/);
  assert.equal(applyEditDraft(g, e, { ...d3, period: 2, timeStr: '5:30' }), '');
  assert.deepEqual([e.period, e.t, e.type, e.att, e.made, e.sub], [2, 330, 'FT', 2, 2, undefined]);
  const sub = { id: 's', type: 'SUB', period: 1, t: 10, inn: ['p6'], out: ['p1'] };
  applyEditDraft(g, sub, { ...newEditDraft(sub), who: 'p3', type: '2M', timeStr: '20' });
  assert.deepEqual([sub.type, sub.t, sub.who], ['SUB', 20, undefined]);
});

test('playConsequences', () => {
  // 5ª falta de un jugador en cancha: cambio obligatorio
  const g = makeGame({ events: fouls('p1', 4) });
  let e = ev('PF', 'p1'); g.events.push(e);
  let c = playConsequences(g, e, { wasOut: false, teamFoulsBefore: 4 });
  assert.deepEqual(c.forced, { out: 'p1', why: '5 faltas', evId: e.id });
  // excluido en la banca: aviso
  const b = makeGame({ events: [ev('TF', 'p6')] });
  e = ev('UF', 'p6'); b.events.push(e);
  c = playConsequences(b, e, { wasOut: false, teamFoulsBefore: 1 });
  assert.equal(c.forced, null);
  assert.equal(c.exclusion, 'Descalificado (T/U)');
  assert.equal(c.fourthTeamFoul, false);
  // 4ª falta de equipo
  const t = makeGame({ events: [ev('PF', 'p1'), ev('PF', 'p2'), ev('PF', 'p3')] });
  e = ev('PF', 'p4'); t.events.push(e);
  assert.equal(playConsequences(t, e, { wasOut: false, teamFoulsBefore: teamFouls(t, 1) - 1 }).fourthTeamFoul, true);
  // DT descalificado
  const s = makeGame({ events: [ev('TF', 'coach')] });
  e = ev('TF', 'coach'); s.events.push(e);
  assert.equal(playConsequences(s, e, { wasOut: false, teamFoulsBefore: 0 }).staffOut, true);
});

test('pendingForcedExit, block reasons, events list helpers', () => {
  const g = makeGame({ events: fouls('p2', 5) });
  assert.equal(pendingForcedExit(g).out, 'p2');
  assert.equal(pendingForcedExit(makeGame()), null);
  assert.match(playBlockReason(g, 'p2', '#5 Acosta'), /ya está fuera/);
  assert.equal(playBlockReason(g, 'p1', '#4'), '');
  assert.match(playBlockReason(makeGame({ events: [ev('DF', 'coach')] }), 'coach', 'DT'), /DT ya está descalificado/);
  const h = makeGame();
  appendEvent(h, { type: '2M', who: 'p1' }, () => 'x1', 10);
  appendEvent(h, { type: '3M', who: 'p1' }, () => 'x2', 20);
  assert.deepEqual(h.events.map((e) => [e.id, e.seq, e.rev, e.at]), [['x1', 1, 1, 10], ['x2', 2, 1, 20]]);
  assert.equal(lastLoggedEvent(h).id, 'x2');
  assert.equal(removeEvent(h, 'x1').id, 'x1');
  assert.equal(removeEvent(h, 'nope'), null);
  assert.equal(playerStats(h, 'p1').pts, 3);
  assert.deepEqual(buildPlayEvent({ period: 2, t: 33.3, x: 10.6, y: null }, { who: 'p1', type: 'FT', att: 2, made: 1, sub: undefined }),
    { period: 2, t: 33.3, x: 11, y: null, who: 'p1', type: 'FT', att: 2, made: 1 });
});
