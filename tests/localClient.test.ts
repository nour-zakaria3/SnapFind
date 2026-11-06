import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalClient } from '../src/demo/localClient';

let c: any;
beforeEach(() => {
  (URL as any).createObjectURL = () => 'blob:demo'; // jsdom does not implement it
  c = createLocalClient({ persist: false });
});

describe('local demo client', () => {
  it('insert + select returns the row with defaults', async () => {
    const { data } = await c.from('folders').insert({ name: 'A', parent_id: null }).select('id,name,parent_id').single();
    expect(data.name).toBe('A');
    expect(data.id).toBeTruthy();
    const list = await c.from('folders').select('*').order('name');
    expect(list.data).toHaveLength(1);
  });

  it('filters: eq, is null, not is null, in', async () => {
    await c.from('images').insert({ id: 'i1', storage_path: 'p1', folder_id: null });
    await c.from('images').insert({ id: 'i2', storage_path: 'p2', folder_id: 'f' });
    await c.from('images').update({ trashed_at: 'now' }).eq('id', 'i2');
    expect((await c.from('images').select('*').is('trashed_at', null)).data.map((r: any) => r.id)).toEqual(['i1']);
    expect((await c.from('images').select('*').not('trashed_at', 'is', null)).data.map((r: any) => r.id)).toEqual(['i2']);
    expect((await c.from('images').select('*').in('id', ['i1', 'zz'])).data).toHaveLength(1);
    expect((await c.from('images').select('*').eq('folder_id', 'f')).data).toHaveLength(1);
  });

  it('update changes only matching rows', async () => {
    await c.from('images').insert({ id: 'i1', storage_path: 'p1' });
    await c.from('images').insert({ id: 'i2', storage_path: 'p2' });
    await c.from('images').update({ ocr_text: 'hello' }).eq('id', 'i1');
    const rows = (await c.from('images').select('*').order('id')).data;
    expect(rows.map((r: any) => r.ocr_text)).toEqual(['hello', '']);
  });

  it('storage upload, download, signed url and remove', async () => {
    await c.storage.from('images').upload('u/a.jpg', new Blob(['abc']));
    expect((await c.storage.from('images').download('u/a.jpg')).data).toBeInstanceOf(Blob);
    expect((await c.storage.from('images').createSignedUrl('u/a.jpg', 60)).data.signedUrl).toBeTruthy();
    await c.storage.from('images').remove(['u/a.jpg']);
    expect((await c.storage.from('images').download('u/a.jpg')).error).toBeTruthy();
  });

  it('rpc search_images ranks by text match and cosine, skips trashed, honors null embedding', async () => {
    await c.from('images').insert({ id: 'i1', storage_path: 'p1', ocr_text: 'Invoice 100%', embedding: [1, 0], status: 'indexed' });
    await c.from('images').insert({ id: 'i2', storage_path: 'p2', ocr_text: '', embedding: [0.9, 0.1], status: 'indexed' });
    await c.from('images').insert({ id: 'i3', storage_path: 'p3', ocr_text: '', embedding: [0, 1], status: 'indexed' });
    await c.from('images').insert({ id: 'i4', storage_path: 'p4', ocr_text: 'invoice', embedding: [1, 0], status: 'indexed', trashed_at: 'x' });
    const vec = await c.rpc('search_images', { query_embedding: JSON.stringify([1, 0]), query_text: '', match_count: 10 });
    expect(vec.data.map((r: any) => r.id)).toEqual(['i1', 'i2']);
    const txt = await c.rpc('search_images', { query_embedding: null, query_text: 'invoice', match_count: 10 });
    expect(txt.data.map((r: any) => r.id)).toEqual(['i1']);
    const pct = await c.rpc('search_images', { query_embedding: null, query_text: '%', match_count: 10 });
    expect(pct.data.map((r: any) => r.id)).toEqual(['i1']);
  });

  it('agent function reports demo mode and auth is always signed in', async () => {
    expect((await c.functions.invoke('agent', { body: { action: 'plan', command: 'x' } } as any)).data).toEqual({ error: 'demo' });
    expect((await c.auth.getUser()).data!.user).toBeTruthy();
  });
});
