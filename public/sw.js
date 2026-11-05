// Service worker: deja abrir la app sin señal.
// - Archivos propios: primero la red (para tomar actualizaciones), si no hay red, la copia guardada.
// - Firebase SDK (CDN): la copia guardada y se actualiza en segundo plano. Las fuentes las sirve la app (fonts/).
// - Firestore, login y el resto de las APIs de Google no pasan por acá.
const VERSION = 'sexto-hombre-v30';
// Módulos de la app (src/). Al agregar o quitar un archivo, actualizar esta lista y VERSION.
const MODULES = [
  'src/application/csv-export.js', 'src/application/game-lock.js', 'src/application/game-report.js', 'src/application/game-session.js', 'src/application/legacy-migration.js', 'src/application/report-export.js', 'src/application/report-games.js', 'src/domain/catalog.js', 'src/domain/club.js', 'src/domain/competition.js', 'src/domain/player-progress.js', 'src/domain/playing-time.js', 'src/domain/shot-chart.js',
  'src/domain/clock.js', 'src/domain/court.js', 'src/domain/dashboard.js', 'src/domain/describe.js', 'src/domain/game-setup.js',
  'src/domain/game.js', 'src/domain/stats.js', 'src/domain/team.js', 'src/infrastructure/pdf/pdf-logo.js', 'src/infrastructure/pdf/report-pdf.js', 'src/infrastructure/xlsx/xlsx-writer.js',
  'src/infrastructure/pdf/pdf-renderer.js', 'src/infrastructure/pdf/share.js', 'src/infrastructure/platform/buzzer.js', 'src/infrastructure/platform/device-id.js', 'src/infrastructure/platform/device.js', 'src/infrastructure/platform/local-data.js', 'src/infrastructure/platform/setup-draft-storage.js', 'src/infrastructure/platform/theme.js',
  'src/infrastructure/store/demo-store.js', 'src/infrastructure/store/firebase-store.js', 'src/infrastructure/store/index.js', 'src/infrastructure/store/pending-tracker.js',
  'src/infrastructure/store/serialization.js', 'src/shared/colors.js', 'src/shared/html.js', 'src/shared/ids.js',
  'src/ui/components/brand.js', 'src/ui/components/charts.js', 'src/ui/components/fields.js', 'src/ui/components/team-card.js', 'src/ui/components/theme-switch.js', 'src/ui/controllers/club-controller.js', 'src/ui/controllers/competition-controller.js', 'src/ui/controllers/reports-controller.js', 'src/ui/controllers/form-controller.js',
  'src/ui/controllers/game-controller.js', 'src/ui/controllers/home-controller.js', 'src/ui/controllers/setup-controller.js', 'src/ui/controllers/team-controller.js',
  'src/ui/dom.js', 'src/ui/focus.js', 'src/ui/events.js', 'src/ui/navigation.js', 'src/ui/render.js',
  'src/ui/selectors.js', 'src/ui/state.js', 'src/ui/toast.js', 'src/ui/dashboard-loader.js', 'src/ui/views/auth-view.js', 'src/ui/views/club-view.js', 'src/ui/views/competition-view.js', 'src/ui/views/reports-view.js',
  'src/ui/views/game/board-view.js', 'src/ui/views/game/court-svg.js', 'src/ui/views/game/game-view.js', 'src/ui/views/game/overlays-view.js',
  'src/ui/views/game/panel-view.js', 'src/ui/views/game/tools-view.js', 'src/ui/views/home-view.js', 'src/ui/views/locked-view.js', 'src/ui/views/setup-view.js',
  'src/ui/views/team-view.js'
];
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', ...MODULES,
  'brand/logo.svg', 'brand/logo-small.svg',
  'fonts.css', 'fonts/dseg7-classic-700.woff2', 'fonts/saira-condensed-latin-500-normal.woff2', 'fonts/saira-condensed-latin-600-normal.woff2', 'fonts/saira-condensed-latin-700-normal.woff2', 'fonts/saira-condensed-latin-800-normal.woff2', 'fonts/ibm-plex-sans-latin-400-normal.woff2', 'fonts/ibm-plex-sans-latin-500-normal.woff2', 'fonts/ibm-plex-sans-latin-600-normal.woff2', 'fonts/ibm-plex-sans-latin-700-normal.woff2',
  'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/favicon-32.png'];
const CDN = ['www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/__/')) return; // login de Firebase
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
    return;
  }
  if (CDN.includes(url.hostname) && (url.hostname !== 'www.gstatic.com' || url.pathname.startsWith('/firebasejs/'))) {
    e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
