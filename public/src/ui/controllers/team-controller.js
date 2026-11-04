// Controlador del editor de plantel.

import { blankTeamDraft, seedTeamDraft, newDraftPlayer, editableTeamDraft, buildTeamDocument } from '../../domain/team.js';
import { app, state, ui, isDemo } from '../state.js';
import { render } from '../render.js';
import { focusId } from '../dom.js';
import { reportSaveError } from '../toast.js';
import { rawTeamById, hasTeams, hasClubs } from '../selectors.js';
import { goHome } from '../navigation.js';
import { newSetup } from './setup-controller.js';
import { editClub } from './club-controller.js';

/**
 * Abre el editor de plantel. Sin clubes, primero se carga el club.
 * @param {string|null} id    plantel a editar (null = nuevo)
 * @param {'home'|'setup'} [after] a dónde volver al cerrar
 * @param {string|null} [clubId] club del plantel nuevo (por defecto, el primero)
 */
export function editTeam(id, after, clubId = null) {
  const team = id ? rawTeamById(id) : null;
  if (!team && !hasClubs()) { editClub(null, after); return; }
  const club = clubId || (state.clubs[0] && state.clubs[0].id);
  state.teamEdit = team ? editableTeamDraft(team) : (hasTeams() ? blankTeamDraft(club) : seedTeamDraft(state.profile, isDemo(), club));
  ui.after = after || 'home';
  ui.setupErr = '';
  ui.colorOpen = null;
  ui.confirm = null;
  state.view = 'team';
  render();
  const cat = document.getElementById('f-cat');
  if (cat && !cat.value) cat.focus();
}

/** Vuelve a la pantalla de origen del editor. */
function leaveEditor(after, teamId) {
  state.teamEdit = null;
  if (after === 'setup') newSetup(teamId);
  else goHome();
}

function saveTeamEdit() {
  const draft = state.teamEdit;
  const result = buildTeamDocument(draft, state.teams || []);
  if (result.error) {
    ui.setupErr = result.error; render();
    const field = /categor|ya tiene un plantel/i.test(result.error) ? document.getElementById('f-cat') : null;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', 'setup-err'); field.focus(); }
    else { const msg = document.getElementById('setup-err'); if (msg) { msg.tabIndex = -1; msg.focus(); } }
    return;
  }
  const { doc } = result;
  app.store.saveTeam(draft.id, doc).catch(reportSaveError);
  const saved = Object.assign({}, rawTeamById(draft.id) || {}, doc, { id: draft.id });
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
    const blank = blankTeamDraft(state.teamEdit.clubId);
    blank.id = state.teamEdit.id;
    state.teamEdit = blank;
    render();
    focusId('f-cat');
  }),
  'team-del': inEditor(deleteTeam),
  'team-branch': inEditor(({ data }) => {
    state.teamEdit.branch = data.v;
    render();
    const checked = document.querySelector('[data-a="team-branch"][aria-checked="true"]');
    if (checked) checked.focus();
  }),
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
  'tp-add': inEditor(() => {
    const p = newDraftPlayer();
    state.teamEdit.players.push(p);
    render();
    focusId('n-' + p.id);
  })
};
