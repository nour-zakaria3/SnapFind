import { beforeEach, describe, expect, it, vi } from 'vitest';

const embedText = vi.fn(async (_t: string) => [0.5]);
vi.mock('../src/imaging/embed', () => ({ embedText: (t: string) => embedText(t) }));

const translate = vi.fn<(t: string) => Promise<string | null>>();
const rpc = vi.fn(async (_n: string, _a: any) => ({ data: [{ id: 'a', score: 0.9 }], error: null }));
const byIds = vi.fn(async (_ids: string[]) => [{ id: 'a' }] as any[]);
vi.mock('../src/agentClient', () => ({ translateToEnglish: (t: string) => translate(t) }));
vi.mock('../src/supabase', () => ({ supabase: { rpc: (n: string, a: any) => rpc(n, a) } }));
vi.mock('../src/api', () => ({ listImagesByIds: (ids: string[]) => byIds(ids) }));

import { searchImages } from '../src/search';

beforeEach(() => { embedText.mockClear(); translate.mockReset(); rpc.mockClear(); byIds.mockClear(); });

describe('searchImages', () => {
  it('Arabic query is translated before embedding', async () => {
    translate.mockResolvedValue('red car');
    await searchImages('سيارة حمراء');
    expect(embedText).toHaveBeenCalledWith('red car');
    expect(rpc.mock.calls[0][1].query_text).toBe('سيارة حمراء');
  });

  it('translation failure falls back to text-only search (no embedding of Arabic)', async () => {
    translate.mockResolvedValue(null);
    await searchImages('سيارة');
    expect(embedText).not.toHaveBeenCalled();
    expect(rpc.mock.calls[0][1].query_embedding).toBeNull();
    expect(rpc.mock.calls[0][1].query_text).toBe('سيارة');
  });

  it('embedding failure still returns text matches', async () => {
    embedText.mockRejectedValueOnce(new Error('model download failed'));
    await searchImages('invoice');
    expect(rpc.mock.calls[0][1].query_embedding).toBeNull();
  });

  it('English query is not translated', async () => {
    await searchImages('red car');
    expect(translate).not.toHaveBeenCalled();
    expect(embedText).toHaveBeenCalledWith('red car');
  });

  it('empty query returns an empty list without calling the backend', async () => {
    expect(await searchImages('   ')).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
    expect(embedText).not.toHaveBeenCalled();
  });

  it('keeps the ranking order returned by the database', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'b', score: 0.9 }, { id: 'a', score: 0.5 }], error: null });
    byIds.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    const out = await searchImages('x');
    expect(out.map((r: any) => r.id)).toEqual(['b', 'a']);
  });
});
