import { button, confirmButton, el } from '../dom';
import type { UiContext } from '../UI';
import { menuBrand } from '../menuChrome';
import { syncLabel } from '../syncLabel';

/** Account operations stay outside gameplay; a changing sync status never recreates typed inputs. */
export function accountScreen(ctx: UiContext): HTMLElement {
  const { accounts } = ctx;
  const panel = el('div', 'panel account-panel');
  const content = el('div', 'account-content');
  const message = el('p', 'account-message'); message.setAttribute('aria-live', 'polite');
  let busy = false, mode: 'login' | 'signup' | 'recover' = 'login', signature = '';
  const status = el('p', 'account-sync-state'); status.setAttribute('aria-live', 'polite');
  const back = button('VOLVER AL INICIO', () => ctx.open('title'));
  const updateButtons = (): void => content.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
    b.disabled = busy || b.dataset.unavailable === 'true';
  });
  const say = (text: string, bad = false): void => { message.textContent = text; message.dataset.error = String(bad); };
  const perform = async (action: () => Promise<void>): Promise<void> => {
    if (busy) return;
    busy = true; panel.setAttribute('aria-busy', 'true');
    updateButtons();
    say('');
    try { await action(); } catch (error) { say(error instanceof Error ? error.message : 'No se pudo completar la acción.', true); }
    finally {
      busy = false; panel.removeAttribute('aria-busy');
      render();
      updateButtons();
    }
  };
  const formView = (): HTMLElement => {
    const recoveryPassword = accounts.recovering && !!accounts.userId;
    const form = el('form', 'account-form');
    const email = el('input', 'field'); email.type = 'email'; email.required = true; email.autocomplete = 'email'; email.placeholder = 'tu@correo.com'; email.maxLength = 254;
    const password = el('input', 'field'); password.type = 'password'; password.required = true; password.minLength = mode === 'signup' || recoveryPassword ? 8 : 1;
    password.maxLength = 128; password.autocomplete = mode === 'signup' || recoveryPassword ? 'new-password' : 'current-password';
    email.setAttribute('aria-label', 'Correo electrónico'); password.setAttribute('aria-label', recoveryPassword ? 'Nueva contraseña' : 'Contraseña');
    if (!recoveryPassword) form.append(el('label', '', el('span', '', 'CORREO ELECTRÓNICO'), email));
    if (mode !== 'recover' || recoveryPassword) form.append(el('label', '', el('span', '', recoveryPassword ? 'NUEVA CONTRASEÑA' : 'CONTRASEÑA'), password));
    const submit = button(recoveryPassword ? 'GUARDAR CONTRASEÑA' : mode === 'signup' ? 'CREAR CUENTA' : mode === 'recover' ? 'ENVIAR ENLACE' : 'ENTRAR', () => {}, 'primary');
    submit.type = 'submit'; submit.dataset.unavailable = String(!accounts.configured || accounts.initializing || (!recoveryPassword && mode !== 'login' && !accounts.emailEnabled));
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!accounts.configured) return;
      if (!form.reportValidity()) return;
      void perform(async () => {
        if (recoveryPassword) { await accounts.changePassword(password.value); password.value = ''; say('Contraseña actualizada.'); }
        else if (mode === 'login') { await accounts.signIn(email.value, password.value); password.value = ''; say(accounts.sync.ready ? 'Cuenta conectada.' : 'Cuenta conectada. Falta cargar tu perfil.'); }
        else if (mode === 'signup') {
          const connected = await accounts.signUp(email.value, password.value); password.value = '';
          say(connected ? 'Cuenta creada y conectada.' : 'Revisá tu correo para confirmar la cuenta. Después podés entrar.');
        } else { await accounts.recover(email.value); say('Si la dirección corresponde a una cuenta, recibirás un enlace de recuperación.'); }
      });
    });
    form.append(submit);
    if (!recoveryPassword) {
      form.append(button(mode === 'login' ? 'CREAR UNA CUENTA' : 'YA TENGO CUENTA', () => { mode = mode === 'login' ? 'signup' : 'login'; signature = ''; say(''); render(); }, 'account-link'));
      if (mode === 'login') form.append(button('OLVIDÉ MI CONTRASEÑA', () => { mode = 'recover'; signature = ''; say(''); render(); }, 'account-link'));
    }
    return form;
  };
  const render = (): void => {
    status.textContent = syncLabel(accounts);
    back.textContent = accounts.isGuest ? 'JUGAR COMO INVITADO' : 'VOLVER AL INICIO';
    const key = `${accounts.userId}:${accounts.recovering}:${accounts.initializing}:${mode}:${accounts.sync.canImport}:${accounts.sync.status === 'conflict' || accounts.sync.status === 'error'}`;
    if (key === signature) return;
    signature = key;
    if (!accounts.userId || accounts.recovering) {
      content.replaceChildren(el('h2', '', accounts.recovering ? 'Volvé a entrar.' : mode === 'signup' ? 'Tu historia, a salvo.' : mode === 'recover' ? 'Recuperá el acceso.' : 'La ciudad te espera.'),
        el('p', 'account-description', accounts.configured ? 'Tu cuenta conserva el perfil, los estilos y la incursión guardada. Podés continuar desde otro celular o PC.' : 'Las cuentas todavía no están configuradas. Podés seguir jugando como invitado en este dispositivo.'),
        ...(!accounts.emailEnabled && mode !== 'login' && !accounts.recovering ? [el('p', 'account-description', 'El registro y la recuperación por correo todavía están en preparación. Mientras tanto podés jugar como invitado.')] : []), formView());
      updateButtons();
      return;
    }
    const actions = el('div', 'account-actions', button('SINCRONIZAR AHORA', () => void perform(() => accounts.sync.retry())),
      button('IR A MI PERFIL', () => ctx.go('profile')));
    if (accounts.sync.canImport) {
      const guest = ctx.profile.guestProfile();
      const importBox = el('div', 'account-import', el('strong', '', '¿Traemos tu progreso local?'),
        el('p', '', `${guest.name} · ${guest.stats.kills} eliminaciones · mejor piso ${guest.stats.bestFloor}. Se puede importar una sola vez a una cuenta vacía.`),
        confirmButton('IMPORTAR PROGRESO LOCAL', 'CONFIRMAR IMPORTACIÓN', () => void perform(() => accounts.importGuest())));
      actions.append(importBox);
    }
    if (accounts.sync.status === 'conflict' || accounts.sync.status === 'error') {
      actions.append(el('p', 'account-description', accounts.sync.error),
        confirmButton('USAR DATOS DEL SERVIDOR', 'DESCARTAR CAMBIOS LOCALES', () => void perform(() => accounts.sync.resolveConflict(false))),
        button('CONSERVAR MIS CAMBIOS', () => void perform(() => accounts.sync.resolveConflict(true))));
    }
    actions.append(button('CERRAR SESIÓN', () => void perform(async () => { await accounts.signOut(); say('Sesión cerrada. Los cambios pendientes quedan asociados a esa cuenta.'); })),
      confirmButton('REINICIAR MI PROGRESO', '¿REINICIAR? TOCÁ OTRA VEZ', () => void perform(async () => { await accounts.sync.reset(); say('Progreso reiniciado en el servidor.'); }), 'danger'),
      confirmButton('ELIMINAR MI CUENTA', '¿ELIMINAR? TOCÁ OTRA VEZ', () => void perform(async () => { await accounts.deleteAccount(); say('Cuenta eliminada.'); }), 'danger'));
    content.replaceChildren(el('h2', '', 'Tu señal está conectada.'), el('p', 'account-email', accounts.email), actions);
    updateButtons();
  };
  ctx.cleanup(accounts.subscribe(render));
  render();
  panel.append(menuBrand(), content, status, message, back);
  return panel;
}
