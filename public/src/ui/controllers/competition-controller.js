// Controlador del editor de competición.

import { blankCompetitionDraft, editableCompetitionDraft, buildCompetitionDocument } from '../../domain/competition.js';
import { chooseCompetition } from '../../domain/game-setup.js';
import { app, state, ui } from '../state.js';
import { render } from '../render.js';
import { reportSaveError } from '../toast.js';
import { competitionById, teamById } from '../selectors.js';
import { goHome, persistView } from '../navigation.js';
import { newSetup } from './setup-controller.js';

/**
 * Abre el editor de competición.
 * @param {string|null} id competición a editar (null = nueva)
 * @param {'home'|'setup'} [after] a dónde volver al cerrar
 */
export function editCompetition(id, after) {
  const c = id ? competitionById(id) : null;
  state.competitionEdit = c ? editableCompetitionDraft(c) : blankCompetitionDraft();
  ui.after = after || 'home';
  ui.setupErr = '';
  ui.confirm = null;
  state.view = 'competition';
  render();
  const name = document.getElementById('f-cpname');
  if (name && !name.value) name.focus();
}

/** Vuelve a la previa o a Mis partidos; desde la previa, deja elegida la competición guardada. */
function leave(after, chosen) {
  state.competitionEdit = null;
  if (after !== 'setup') { goHome(); return; }
  newSetup();
  if (chosen && state.setup) {
    chooseCompetition(state.setup, chosen, teamById(state.setup.teamId));
    persistView();
    render();
    const sel = document.getElementById('f-comp');
    if (sel) sel.focus();
  }
}

function save() {
  const draft = state.competitionEdit;
  const result = buildCompetitionDocument(draft, state.competitions || []);
  if (result.error) {
    ui.setupErr = result.error; render();
    const field = /temporada/i.test(result.error) ? document.getElementById('f-season') : document.getElementById('f-cpname');
    if (field) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', 'setup-err'); field.focus(); }
    return;
  }
  app.store.saveCompetition(draft.id, result.doc).catch(reportSaveError);
  const saved = Object.assign({}, competitionById(draft.id) || {}, result.doc, { id: draft.id });
  state.competitions = (state.competitions || []).filter((x) => x.id !== draft.id).concat(saved);
  leave(ui.after, draft.isNew ? saved : null);
}

function remove() {
  if (ui.confirm !== 'cpdel') { ui.confirm = 'cpdel'; render(); return; }
  const id = state.competitionEdit.id;
  app.store.saveCompetition(id, { deleted: true }).catch(reportSaveError);
  state.competitions = (state.competitions || []).filter((x) => x.id !== id);
  leave(ui.after, null);
}

const inEditor = (fn) => (ctx) => { if (state.view === 'competition') fn(ctx); };

export const competitionActions = {
  'new-competition': () => {
    if (state.view === 'setup') { persistView(); editCompetition(null, 'setup'); }
    else editCompetition(null, 'home');
  },
  'edit-competition': ({ id }) => editCompetition(id, 'home'),
  'comp-cancel': inEditor(() => leave(ui.after, null)),
  'comp-save': inEditor(save),
  'comp-del': inEditor(remove)
};
