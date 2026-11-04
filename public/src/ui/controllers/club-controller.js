// Controlador del editor de club.

import { blankClubDraft, seedClubDraft, editableClubDraft, newDraftVenue, toggleDefaultVenue, buildClubDocument } from '../../domain/club.js';
import { app, state, ui, isDemo } from '../state.js';
import { render } from '../render.js';
import { focusId } from '../dom.js';
import { reportSaveError } from '../toast.js';
import { clubById, hasClubs, hasTeams, teamsOfClub } from '../selectors.js';
import { goHome, persistView } from '../navigation.js';
import { editTeam } from './team-controller.js';
import { newSetup } from './setup-controller.js';

/**
 * Abre el editor de club.
 * @param {string|null} id club a editar (null = nuevo)
 * @param {'home'|'setup'} [after] a dónde volver al cerrar
 */
export function editClub(id, after) {
  const club = id ? clubById(id) : null;
  state.clubEdit = club ? editableClubDraft(club) : (hasClubs() ? blankClubDraft() : seedClubDraft(state.profile, isDemo()));
  ui.after = after || 'home';
  ui.setupErr = '';
  ui.colorOpen = null;
  ui.confirm = null;
  state.view = 'club';
  render();
  const name = document.getElementById('f-cname');
  if (name && !name.value) name.focus();
}

function back(after) {
  state.clubEdit = null;
  if (after === 'setup' && hasTeams()) newSetup();
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

function showError(error, draft) {
  ui.setupErr = error; render();
  const field = /nombre del club|club llamado/i.test(error) ? document.getElementById('f-cname') : /estadio/i.test(error) ? firstIncompleteVenue(draft) : null;
  if (field) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', 'setup-err'); field.focus(); }
  else { const msg = document.getElementById('setup-err'); if (msg) { msg.tabIndex = -1; msg.focus(); } }
}

function saveClubEdit() {
  const draft = state.clubEdit;
  const result = buildClubDocument(draft, state.clubs || []);
  if (result.error) { showError(result.error, draft); return; }
  app.store.saveClub(draft.id, result.doc).catch(reportSaveError);
  const saved = Object.assign({}, clubById(draft.id) || {}, result.doc, { id: draft.id });
  state.clubs = (state.clubs || []).filter((x) => x.id !== draft.id).concat(saved);
  const after = ui.after;
  state.clubEdit = null;
  // Un club sin planteles (recién creado): seguimos con el primero.
  if (!teamsOfClub(draft.id).length) editTeam(null, after, draft.id);
  else if (after === 'setup') newSetup();
  else goHome();
}

function deleteClub() {
  const id = state.clubEdit.id;
  if (teamsOfClub(id).length) { showError('Primero borrá sus planteles o pasalos a otro club.', state.clubEdit); return; }
  if (ui.confirm !== 'cdel') { ui.confirm = 'cdel'; render(); return; }
  app.store.saveClub(id, { deleted: true }).catch(reportSaveError);
  state.clubs = (state.clubs || []).filter((x) => x.id !== id);
  state.clubEdit = null;
  goHome();
}

/** Envuelve la acción para que solo corra en el editor de club. */
const inEditor = (fn) => (ctx) => { if (state.view === 'club') fn(ctx); };

export const clubActions = {
  'new-club': () => editClub(null, 'home'),
  // Desde la previa edita el club del plantel elegido y vuelve a la previa.
  'edit-club': ({ id }) => {
    if (state.view === 'setup') { persistView(); editClub(id, 'setup'); }
    else editClub(id || null, 'home');
  },
  'club-cancel': inEditor(() => back(ui.after)),
  'club-save': inEditor(saveClubEdit),
  'club-del': inEditor(deleteClub),
  'club-clear': inEditor(() => {
    const blank = blankClubDraft();
    blank.id = state.clubEdit.id;
    state.clubEdit = blank;
    render();
    focusId('f-cname');
  }),
  'cv-add': inEditor(() => {
    const v = newDraftVenue();
    state.clubEdit.venues = (state.clubEdit.venues || []).concat(v);
    render();
    focusId('vn-' + v.id);
  }),
  'cv-rm': inEditor(({ id }) => {
    const c = state.clubEdit;
    c.venues = (c.venues || []).filter((x) => x.id !== id);
    if (c.defaultVenueId === id) c.defaultVenueId = null;
    render();
    focusId(c.venues.length ? 'vn-' + c.venues[c.venues.length - 1].id : 'cv-add');
  }),
  'cv-default': inEditor(({ id }) => {
    toggleDefaultVenue(state.clubEdit, id);
    render();
    focusId('vd-' + id);
  })
};
