import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildXlsx, crc32, zipStore } from '../public/src/infrastructure/xlsx/xlsx-writer.js';
import { buildReportExport, reportSheets } from '../public/src/application/report-export.js';

/** Lee las entradas de un ZIP «store» (directorio central) y verifica el CRC de cada una. */
function readZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endAt = bytes.length - 22;
  assert.equal(dv.getUint32(endAt, true), 0x06054b50);
  const count = dv.getUint16(endAt + 10, true);
  let p = dv.getUint32(endAt + 16, true);
  const out = {};
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50);
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
    assert.equal(dv.getUint32(off, true), 0x04034b50);
    const start = off + 30 + dv.getUint16(off + 26, true);
    const data = bytes.subarray(start, start + size);
    assert.equal(crc32(data), crc, 'CRC de ' + name);
    out[name] = new TextDecoder().decode(data);
    p += 46 + nlen;
  }
  return out;
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('zip store round-trips entries', () => {
  const z = readZip(zipStore([{ name: 'a.txt', data: new TextEncoder().encode('hola') }, { name: 'ñ/b.xml', data: new TextEncoder().encode('<x/>') }]));
  assert.deepEqual(z, { 'a.txt': 'hola', 'ñ/b.xml': '<x/>' });
});

test('xlsx: workbook, sheets, numbers as numbers and text never as formula', () => {
  const z = readZip(buildXlsx([{ name: 'Por partido', rows: [[{ v: 'Fecha', bold: true }, 'Rival'], ['01/10/2026', '=HYPERLINK("x")', 12.5, null]] }, { name: 'Bad/Name?', rows: [] }]));
  assert.ok(z['[Content_Types].xml'].includes('/xl/worksheets/sheet2.xml'));
  assert.ok(z['xl/workbook.xml'].includes('name="Por partido"'));
  assert.ok(z['xl/workbook.xml'].includes('name="Bad Name"'));
  const s1 = z['xl/worksheets/sheet1.xml'];
  assert.ok(s1.includes('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Fecha</t></is></c>'));
  assert.ok(s1.includes('<c r="C2"><v>12.5</v></c>'));
  assert.ok(s1.includes('t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;x&quot;)</t>'));
  assert.ok(!s1.includes('<f>'));
  assert.ok(!s1.includes('r="D2"'));
});

const roster = [{ id: 'a', num: '4', name: 'Ana' }, { id: 'b', num: '7', name: 'Bea' }];
const games = [
  { id: 'g1', date: '2026-10-01', opponent: 'Rival 1', roster, oppP: { 1: 10 }, attackFirstHalf: 'left', events: [{ who: 'a', type: '2M', x: 180, y: 760, period: 1, t: 0 }, { who: 'b', type: '3X', x: 950, y: 750, period: 1, t: 0 }] },
  { id: 'g2', date: '2026-10-08', opponent: 'Rival 2', roster: [roster[1]], oppP: {}, attackFirstHalf: 'left', events: [{ who: 'b', type: '3M', x: 950, y: 750, period: 1, t: 0 }] }
];

test('report export: team rows chronological, record, averages and zones', () => {
  const r = buildReportExport(games, {}, { teamLabel: 'Brown · Senior', now: new Date('2026-11-05T12:00:00') });
  assert.equal(r.subject, 'Todo el equipo');
  assert.deepEqual(r.rows.map((x) => [x.opponent, x.result, x.us, x.them]), [['Rival 1', 'P', 2, 10], ['Rival 2', 'G', 3, 0]]);
  assert.deepEqual(r.record, { G: 1, P: 1, E: 0 });
  const pts = r.stats.findIndex((s) => s.id === 'pts');
  assert.equal(r.averages[pts], 2.5);
  assert.equal(r.shotChart.att, 3);
  assert.equal(r.shotChart.made, 2);
  assert.equal(r.fileBase, 'Informe_Brown-Senior_2026-11-05');
});

test('report export: player filter keeps only games where they were called up', () => {
  const r = buildReportExport(games, { playerId: 'a' }, { teamLabel: 'Brown', playerLabel: '#4 Ana', now: new Date('2026-11-05T12:00:00') });
  assert.equal(r.gamesCount, 1);
  assert.equal(r.shotChart.att, 1);
  assert.ok(r.fileBase.includes('4-Ana'));
  const [byGame, zones] = reportSheets(r);
  assert.equal(byGame.name, 'Por partido');
  assert.equal(zones.name, 'Tiros por zona');
  // info (4 filas) + encabezado + 1 partido + promedio
  assert.equal(byGame.rows.length, 7);
  assert.equal(byGame.rows[5][4], 2);
});
