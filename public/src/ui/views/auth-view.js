// Pantallas de ingreso y de cuenta no habilitada.

import { esc } from '../../shared/html.js';
import { state, ui } from '../state.js';
import { brandMark } from '../components/brand.js';

const brandHeader = () => brandMark('blogo') + '<p class="bword big">SEXTO HOMBRE</p>';

export function loginHTML() {
  return '<div class="brandscreen"><section class="bcard">' + brandHeader() +
    '<p class="btag">La planilla del cuerpo técnico</p>' +
    '<p class="bcopy">Ingresá con tu cuenta de Google para guardar los partidos y compartir la planilla.</p>' +
    '<button class="btn big gbtn bprimary" data-a="login"><span class="g" aria-hidden="true">G</span>Ingresar con Google</button>' +
    '<p class="err" role="alert">' + esc(ui.authErr || '') + '</p></section></div>';
}

export function deniedHTML() {
  return '<div class="brandscreen"><section class="bcard">' + brandHeader() +
    '<h1 class="btitle">Tu cuenta no está habilitada</h1>' +
    '<p class="bcopy">Ingresaste como <strong>' + esc(state.user.email) + '</strong>. Por ahora la app es de uso interno: pedile a quien la administra que agregue ese correo.</p>' +
    '<div class="row"><button class="btn big bprimary" data-a="retry-allow">Reintentar</button><button class="btn big bghost" data-a="logout">Usar otra cuenta</button></div></section></div>';
}
