// Controlador del editor de plantel.

import { blankTeamDraft, seedTeamDraft, newDraftPlayer, newDraftVenue, editableTeamDraft, buildTeamDocument } from '../../domain/team.js';
import { app, state, ui, isDemo } from '../state.js';
import { render } from '../render.js';
import { focusId } from '../dom.js';
import { reportSaveError } from '../toast.js';
import { teamById, hasTeams } from '../selectors.js';
import { goHome } from '../navigation.js';
import { newSetup } from './setup-controller.js';

/**
 * Abre el editor de plantel.
 * @param {string|null} id    plantel a editar (null = nuevo)
 * @param {'home'|'setup'} [after] a dónde volver al cerrar
 */
export function editTeam(id, after) {
  const team = id ? teamById(id) : null;
  state.teamEdit = team ? editableTeamDraft(team) : (hasTeams() ? blankTeamDraft() : seedTeamDraft(state.profile, isDemo()));
  ui.after = after || 'home';
  ui.setupErr = '';
  ui.colorOpen = null;
  ui.confirm = null;
  state.view = 'team';
  render();
  const name = document.getElementById('f-tname');
  if (name && !name.value) name.focus();
}

/** Vuelve a la pantalla de origen del editor. */
function leaveEditor(after, teamId) {
  state.teamEdit = null;
  if (after === 'setup') newSetup(teamId);
  else goHome();
}

/** Primer campo vacío de un estadio a medio cargar. */
function firstIncompleteVenue(draft) {
  for (const v of draft.venues || []) {
    const name = String(v.name || '').trim(), loc = String(v.location || '').trim();
    if ((name || loc) && !(name && loc)) return document.getElementById((name ? 'vl-' : 'vn-') + v.id);
  }
  return (draft.venues || [])[0] ? document.getElementById('vn-' + draft.venues[0].id) : null;
}

function saveTeamEdit() {
  const draft = state.teamEdit;
  const result = buildTeamDocument(draft);
  if (result.error) {
    ui.setupErr = result.error; render();
    const field = /nombre del equipo/i.test(result.error) ? document.getElementById('f-tname') : /estadio/i.test(result.error) ? firstIncompleteVenue(draft) : null;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', 'setup-err'); field.focus(); }
    else { const msg = document.getElementById('setup-err'); if (msg) { msg.tabIndex = -1; msg.focus(); } }
    return;
  }
  const { doc } = result;
  app.store.saveTeam(draft.id, doc).catch(reportSaveError);
  const saved = Object.assign({}, teamById(draft.id) || {}, doc, { id: draft.id });
  state.teams = (state.teams || []).filter((x) => x.id !== draft.id).concat(saved);
  leaveEditor(ui.after, draft.id);
}

function deleteTeam() {
  if (ui.confirm !== 'tdel') { ui.confirm = 'tdel'; render(); return; }
  const id = state.teamEdit.id;
  app.store.saveTeam(id, { deleted: true }).catch(reportSaveError);
  state.teams = (state.teams || []).filter((x) => x.id !== id);
  state.teamEdit = null;
  goHome();
}

const findDraftPlayer = (id) => state.teamEdit.players.find((x) => x.id === id);

/** Envuelve la acción para que solo corra en el editor de plantel. */
const inEditor = (fn) => (ctx) => { if (state.view === 'team') fn(ctx); };

export const teamActions = {
  'team-cancel': inEditor(() => {
    const after = ui.after;
    state.teamEdit = null;
    if (after === 'setup' && hasTeams()) newSetup();
    else goHome();
  }),
  'team-save': inEditor(saveTeamEdit),
  'team-clear': inEditor(() => {
    const blank = blankTeamDraft();
    blank.id = state.teamEdit.id;
    state.teamEdit = blank;
    render();
    focusId('f-tname');
  }),
  'team-del': inEditor(deleteTeam),
  'tp-active': inEditor(({ id }) => {
    const p = findDraftPlayer(id);
    if (!p) return;
    p.active = p.active === false;
    render();
  }),
  'tp-rm': inEditor(({ id }) => {
    state.teamEdit.players = state.teamEdit.players.filter((x) => x.id !== id);
    render();
  }),
  'tv-add': inEditor(() => {
    const v = newDraftVenue();
    state.teamEdit.venues = (state.teamEdit.venues || []).concat(v);
    render();
    focusId('vn-' + v.id);
  }),
  'tv-rm': inEditor(({ id }) => {
    state.teamEdit.venues = (state.teamEdit.venues || []).filter((x) => x.id !== id);
    render();
    focusId(state.teamEdit.venues.length ? 'vn-' + state.teamEdit.venues[state.teamEdit.venues.length - 1].id : 'tv-add');
  }),
  'tp-add': inEditor(() => {
    const p = newDraftPlayer();
    state.teamEdit.players.push(p);
    render();
    focusId('n-' + p.id);
  })
};
