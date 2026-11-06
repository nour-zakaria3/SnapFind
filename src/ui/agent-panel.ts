import { executePlan, requestPlan, type Operation } from '../agent';
import { t } from '../i18n';
import { listImagesByIds } from '../api';
import { el } from './dom';

function describe(op: Operation, snip: Map<string, string>): string {
  switch (op.op) {
    case 'create_folder': return `📁 ${op.name}`;
    case 'move': return `${snip.get(op.imageId) ?? op.imageId.slice(0, 6)} ⟶ ${op.folderName}`;
    case 'rename': return `✏️ ${op.name}`;
    case 'trash': return `🗑️ ${snip.get(op.imageId) ?? op.imageId.slice(0, 6)}`;
  }
}

export function renderAgentPanel(onChanged: () => Promise<void>): HTMLElement {
  const input = el('input', { type: 'text', placeholder: t('agent_placeholder') });
  const output = el('div');
  const say = (text: string, cls = '') => output.replaceChildren(el('p', { class: cls }, text));

  const run = el('button', {
    onclick: async () => {
      if (!input.value.trim()) return;
      say('…');
      const res = await requestPlan(input.value);
      if ('error' in res) {
        say(res.error === 'quota' ? t('agent_quota') : `${res.error}${res.reason ? `: ${res.reason}` : ''}`, 'error');
        return;
      }
      if (res.question) { say(res.question); return; }
      if (res.ops.length === 0) { say('—'); return; }
      const ids = [...new Set(res.ops.flatMap((o) => ('imageId' in o ? [o.imageId] : [])))];
      const rows = await listImagesByIds(ids).catch(() => []);
      const snip = new Map(rows.map((r, i) => [r.id, `#${i + 1} ${r.ocr_text.slice(0, 40) || r.storage_path.split('/').pop()}`]));
      const list = el('ul', {}, ...res.ops.map((o) => el('li', {}, describe(o, snip))));
      const confirm = el('button', {
        onclick: async () => {
          const r = await executePlan(res.ops);
          say(r.failed ? `${r.done}/${res.ops.length} — ${r.failed.message}` : `✓ ${r.done}`, r.failed ? 'error' : '');
          await onChanged();
        },
      }, t('agent_confirm'));
      const cancel = el('button', { class: 'secondary', onclick: () => output.replaceChildren() }, t('agent_cancel'));
      output.replaceChildren(list, confirm, cancel);
    },
  }, t('agent_run'));

  return el('section', { class: 'agent' }, el('h3', {}, t('agent_title')), input, run, output);
}
