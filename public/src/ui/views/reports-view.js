// «Informes»: mapa de tiros por zonas y progreso partido a partido.

import { esc } from '../../shared/html.js';
import { formatDate } from '../../shared/ids.js';
import { teamLabel } from '../../domain/club.js';
import { buildShotChart, MIN_ATTEMPTS_FOR_PCT } from '../../domain/shot-chart.js';
import { PROGRESS_STATS, playerSeries, playersInGames } from '../../domain/player-progress.js';
import { state } from '../state.js';
import { TOAST_HTML } from '../toast.js';
import { resolvedTeams, competitionsList } from '../selectors.js';
import { shotChartSVG, lineChartSVG, zoneClass, decimal } from '../components/charts.js';

const pctText = (p) => (p == null ? '—' : Math.round(p * 100) + '%');

function option(value, label, selected) {
  return '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>';
}

function radio(action, value, checked, label) {
  return '<button role="radio" data-a="' + action + '" data-v="' + value + '" aria-checked="' + checked + '" tabindex="' + (checked ? 0 : -1) + '">' + label + '</button>';
}

function filtersHTML(f, players) {
  const teams = resolvedTeams();
  const comps = competitionsList();
  return '<section class="card"><h2>Filtros</h2><div class="setup-grid rep-filters">' +
    '<div class="field"><label for="f-rteam">Plantel</label><select id="f-rteam" data-f="teamId">' +
      teams.map((t) => option(t.id, teamLabel(t), t.id === f.teamId)).join('') + '</select></div>' +
    '<div class="field"><label for="f-rplayer">Jugador</label><select id="f-rplayer" data-f="playerId">' + option('', 'Todo el equipo', !f.playerId) +
      players.map((p) => option(p.id, (p.num !== '' && p.num != null ? '#' + p.num + ' ' : '') + (p.name || 'Sin nombre'), p.id === f.playerId)).join('') + '</select></div>' +
    '<div class="field"><label for="f-rcomp">Competición</label><select id="f-rcomp" data-f="competitionId">' + option('', 'Todas', !f.competitionId) +
      option('none', 'Amistosos / sin competición', f.competitionId === 'none') +
      comps.map((c) => option(c.id, c.name + (c.season ? ' ' + c.season : ''), c.id === f.competitionId)).join('') + '</select></div>' +
    '<div class="field"><label for="f-rfrom">Desde</label><input id="f-rfrom" type="date" data-f="from" value="' + esc(f.from) + '"></div>' +
    '<div class="field"><label for="f-rto">Hasta</label><input id="f-rto" type="date" data-f="to" value="' + esc(f.to) + '"></div>' +
    '</div></section>';
}

function tabsHTML(tab) {
  const t = (id, label) => '<button role="tab" id="rt-' + id + '" data-a="rep-tab" data-v="' + id + '" aria-controls="rp-panel" aria-selected="' + (tab === id) + '" tabindex="' + (tab === id ? 0 : -1) + '">' + label + '</button>';
  return '<div class="rtabs" role="tablist" aria-label="Informe">' + t('shots', 'Mapa de tiros') + t('progress', 'Progreso') + '</div>';
}

function legendHTML(mode) {
  if (mode === 'volume') {
    return '<div class="zlegend" aria-hidden="true"><span>Menos tiros</span>' + [1, 2, 3, 4, 5].map((i) => '<i class="z-v' + i + '"></i>').join('') + '<span>Más tiros</span><span class="zl-none"><i class="z-none"></i>Sin tiros</span></div>' +
      '<p class="lead rnote">El número es la cantidad de tiros desde cada zona.</p>';
  }
  const item = (cls, label) => '<span><i class="' + cls + '"></i>' + label + '</span>';
  return '<div class="zlegend wrap" aria-hidden="true">' + item('z-dn2', 'Muy por debajo') + item('z-dn1', 'Por debajo') + item('z-d0', 'Normal') +
    item('z-dp1', 'Por encima') + item('z-dp2', 'Muy por encima') + item('z-few', 'Menos de ' + MIN_ATTEMPTS_FOR_PCT + ' tiros') + item('z-none', 'Sin tiros') + '</div>' +
    '<p class="lead rnote">«Normal» es rendir un punto por tiro: 50% en dobles o 33% en triples. En rojo, donde más se erra para lo que vale el tiro.</p>';
}

function zoneTableHTML(chart, mode) {
  const maxAtt = Math.max(1, ...chart.zones.filter((z) => z.id !== 'back').map((z) => z.att));
  const rows = chart.zones.filter((z) => z.att).map((z) =>
    '<tr><th scope="row"><i class="zsw ' + zoneClass(z, mode, maxAtt) + '" aria-hidden="true"></i>' + esc(z.label) + '</th><td>' + z.made + '/' + z.att + '</td><td>' + pctText(z.pct) + '</td><td>' + Math.round(z.share * 100) + '%</td></tr>').join('');
  return '<table class="rtable"><caption>Tiros por zona</caption><thead><tr><th scope="col">Zona</th><th scope="col">Conv./Int.</th><th scope="col">Acierto</th><th scope="col">De los tiros</th></tr></thead>' +
    '<tbody>' + rows + '</tbody><tfoot><tr><th scope="row">Total</th><td>' + chart.total.made + '/' + chart.total.att + '</td><td>' + pctText(chart.total.att ? chart.total.made / chart.total.att : null) + '</td><td></td></tr></tfoot></table>';
}

function shotsPanelHTML(games, f) {
  const chart = buildShotChart(games, { playerId: f.playerId || null });
  if (!chart.total.att) return '<p class="lead">No hay tiros de campo cargados con estos filtros.</p>';
  const mode = f.mode === 'volume' ? 'volume' : 'pct';
  return '<div class="field"><span class="flabel" id="rmode-l">Colorear por</span><div class="seg rmode" role="radiogroup" aria-labelledby="rmode-l">' +
      radio('rep-mode', 'pct', mode === 'pct', 'Acierto') + radio('rep-mode', 'volume', mode === 'volume', 'Volumen') + '</div></div>' +
    '<div class="shotwrap">' + shotChartSVG(chart, mode) + '</div>' + legendHTML(mode) +
    (chart.unlocated ? '<p class="note">' + chart.unlocated + ' de ' + chart.total.att + ' tiros no tienen ubicación en la cancha: cuentan en el total pero no en las zonas.</p>' : '') +
    zoneTableHTML(chart, mode);
}

function progressPanelHTML(games, f) {
  const series = playerSeries(games, f.playerId || null, f.stat);
  const stat = series.stat;
  const select = '<div class="field rstat"><label for="f-rstat">Estadística</label><select id="f-rstat" data-f="stat">' +
    PROGRESS_STATS.map((s) => option(s.id, s.label, s.id === stat.id)).join('') + '</select></div>';
  if (!series.points.length) return select + '<p class="lead">El jugador no fue convocado en los partidos de estos filtros.</p>';
  const rows = series.points.slice().reverse().map((p) => '<tr><th scope="row">' + esc(formatDate(p.date)) + '</th><td>' + esc(p.opponent) + '</td><td>' +
    (p.value == null ? '—' : decimal(p.value) + (stat.pct ? '%' : '')) + (p.detail ? ' <span class="muted">(' + esc(p.detail) + ')</span>' : '') + '</td></tr>').join('');
  return select + '<h3 class="rh">' + esc(stat.label) + (f.playerId ? '' : ' del equipo') + '</h3>' +
    '<div class="linewrap">' + lineChartSVG(series) + '</div>' +
    (stat.pct ? '<p class="lead rnote">Los partidos sin intentos no tienen punto.</p>' : '') +
    '<table class="rtable"><caption>' + esc(stat.label) + ' por partido (el más reciente primero)</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Rival</th><th scope="col">' + esc(stat.label) + '</th></tr></thead><tbody>' + rows + '</tbody>' +
    '<tfoot><tr><th scope="row">Promedio</th><td></td><td>' + (series.average == null ? '—' : decimal(series.average) + (stat.pct ? '%' : '')) + '</td></tr></tfoot></table>' ;
}

function bodyHTML() {
  const f = state.reports, games = state.reportGames;
  if (!f.teamId) return '<section class="card"><p class="lead">Cargá un plantel y jugá partidos para ver informes.</p></section>';
  if (games === null) return '<section class="card"><p class="lead" role="status">Juntando los partidos…</p></section>';
  const count = '<p class="lead" role="status">' + (games.length === 1 ? '1 partido' : games.length + ' partidos') + ' en el informe.</p>';
  if (!games.length) return '<section class="card">' + count + '<p class="lead">No hay partidos de este plantel con estos filtros.</p></section>';
  const exportBar = '<div class="row rexport"><button class="btn share" data-a="rep-export" data-v="pdf">Exportar PDF</button><button class="btn" data-a="rep-export" data-v="xlsx">Exportar Excel</button>' +
    '<span class="lead">Incluye el resumen por partido de todas las estadísticas y los tiros por zona.</span></div>';
  return '<section class="card">' + exportBar + tabsHTML(f.tab) + count +
    '<div id="rp-panel" role="tabpanel" aria-labelledby="rt-' + f.tab + '" class="rpanel">' + (f.tab === 'progress' ? progressPanelHTML(games, f) : shotsPanelHTML(games, f)) + '</div></section>';
}

export function reportsHTML() {
  const players = playersInGames(state.reportGames || []);
  return '<div class="setup reports"><header class="setup-head"><div><p class="eyebrow"><button class="linkback" data-a="go-home">‹ Volver</button></p><h1 id="rep-h1" tabindex="-1">Informes</h1></div></header>' +
    (state.reports.teamId ? filtersHTML(state.reports, players) : '') + bodyHTML() + TOAST_HTML + '</div>';
}
