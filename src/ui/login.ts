import { signIn, signUp } from '../auth';
import { t } from '../i18n';
import { el } from './dom';

export function renderLogin(onDone: () => void): HTMLElement {
  const email = el('input', { type: 'email', placeholder: t('email'), autocomplete: 'email' });
  const password = el('input', { type: 'password', placeholder: t('password'), autocomplete: 'current-password' });
  const msg = el('p', { class: 'error' });
  const run = (fn: typeof signIn) => async () => {
    msg.textContent = '';
    try {
      await fn(email.value, password.value);
      onDone();
    } catch (e) {
      msg.textContent = (e as Error).message;
    }
  };
  return el('form', { class: 'login', onsubmit: (e: Event) => e.preventDefault() },
    el('h1', {}, t('app_title')), email, password,
    el('button', { type: 'submit', onclick: run(signIn) }, t('login')),
    el('button', { type: 'button', class: 'secondary', onclick: run(signUp) }, t('signup')),
    msg);
}
