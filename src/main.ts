import './styles.css';
import { currentUserId, signOut } from './auth';
import { getLang, loadSavedLang, setLang, t } from './i18n';
import { isDemo } from './supabase';
import { el } from './ui/dom';
import { renderGallery } from './ui/gallery';
import { renderLogin } from './ui/login';

const app = document.querySelector<HTMLDivElement>('#app')!;

async function render(): Promise<void> {
  document.title = t('app_title');
  app.replaceChildren();
  const toggle = el('button', {
    class: 'secondary',
    onclick: () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); void render(); },
  }, t('language'));

  let signedIn = false;
  try { signedIn = !!(await currentUserId()); } catch { /* not configured yet */ }

  if (!signedIn) {
    app.append(toggle, renderLogin(() => void render()));
    return;
  }
  const out = el('button', { class: 'secondary', onclick: async () => { await signOut(); void render(); } }, t('logout'));
  const content = el('main');
  app.append(el('div', { class: 'bar' }, toggle, ...(isDemo ? [el('span', { class: 'muted' }, t('demo_banner'))] : [out])), content);
  await renderGallery(content);
}

setLang(loadSavedLang());
void render();
