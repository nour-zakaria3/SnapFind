import { createFolder, listFolders, listImages, moveImage, restoreImage, signedUrl, trashImage } from '../api';
import { searchImages } from '../search';
import { retryPending, uploadImages } from '../upload';
import { t } from '../i18n';
import type { Folder, ImageRow } from '../types';
import { el } from './dom';
import { renderAgentPanel } from './agent-panel';

interface State { folderId: string | null; trash: boolean; results: ImageRow[] | null; query: string }

export async function renderGallery(root: HTMLElement): Promise<void> {
  const state: State = { folderId: null, trash: false, results: null, query: '' };
  let generation = 0;

  const refresh = async () => {
    const mine = ++generation;
    const [folders, images] = await Promise.all([
      listFolders(),
      state.results ? Promise.resolve(state.results) : listImages(state.folderId, state.trash),
    ]);
    const hdr = await header(folders);
    const body = el('div', { class: 'layout' }, sidebar(folders), await grid(images, folders));
    if (mine !== generation) return; // a newer refresh superseded this one
    root.replaceChildren(hdr, body, renderAgentPanel(refresh));
  };

  const header = async (_f: Folder[]) => {
    const q = el('input', { type: 'search', placeholder: t('search_placeholder'), value: state.query });
    const picker = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const status = el('span', { class: 'muted' });
    picker.onchange = async () => {
      await uploadImages(Array.from(picker.files ?? []), state.folderId, (d, n, failed) => {
        status.textContent = `${d}/${n}` + (failed.length ? ` — ${t('upload_failed')}: ${failed.map((f) => `${f.name} (${f.message})`).join(', ')}` : '');
      });
      await retryPending().catch(() => {});
      await refresh();
    };
    return el('header', { class: 'bar' },
      q,
      el('button', { onclick: async () => { state.query = q.value; state.results = q.value.trim() ? await searchImages(q.value) : null; await refresh(); } }, t('search')),
      el('button', { class: 'secondary', onclick: () => picker.click() }, t('upload')), picker, status);
  };

  const sidebar = (folders: Folder[]) => {
    const item = (label: string, active: boolean, go: () => void) =>
      el('button', { class: active ? '' : 'secondary', onclick: () => { state.results = null; go(); void refresh(); } }, label);
    return el('nav', { class: 'side' },
      el('h3', {}, t('folders')),
      item(t('all_images'), !state.trash && state.folderId === null, () => { state.folderId = null; state.trash = false; }),
      ...folders.map((f) => item(f.name, !state.trash && state.folderId === f.id, () => { state.folderId = f.id; state.trash = false; })),
      el('button', { class: 'secondary', onclick: async () => { const n = prompt(t('new_folder')); if (n) { await createFolder(n, null); await refresh(); } } }, `+ ${t('new_folder')}`),
      item(t('trash'), state.trash, () => { state.trash = true; }));
  };

  const grid = async (images: ImageRow[], folders: Folder[]) => {
    const cards = await Promise.all(images.map(async (img) => {
      const actions = state.trash
        ? [el('button', { class: 'secondary', onclick: async () => { state.results = null; await restoreImage(img.id); await refresh(); } }, t('restore'))]
        : [
            el('button', { class: 'secondary', onclick: async () => { state.results = null; await trashImage(img.id); await refresh(); } }, t('move_to_trash')),
            moveSelect(img, folders),
          ];
      return el('figure', { class: 'card' },
        el('img', { src: await signedUrl(img.storage_path).catch(() => ''), loading: 'lazy', alt: img.ocr_text.slice(0, 80) }),
        img.status === 'pending' ? el('small', { class: 'muted' }, t('pending')) : '', ...actions);
    }));
    return el('section', { class: 'grid' }, ...cards);
  };

  const moveSelect = (img: ImageRow, folders: Folder[]) => {
    const s = el('select', { onchange: async () => { state.results = null; await moveImage(img.id, s.value || null); await refresh(); } },
      el('option', { value: '' }, t('all_images')),
      ...folders.map((f) => Object.assign(el('option', { value: f.id }, f.name), { selected: f.id === img.folder_id })));
    return s;
  };

  await refresh();
}
