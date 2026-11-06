import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal chainable mock of the Supabase query builder.
const calls: { table: string; method: string; args: unknown[] }[] = [];
function builder(table: string, result: unknown = { data: [], error: null }) {
  const b: any = new Proxy({}, {
    get(_t, method: string) {
      if (method === 'then') return (res: (v: unknown) => void) => res(result);
      return (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    },
  });
  return b;
}

vi.mock('../src/supabase', () => ({
  supabase: {
    from: (table: string) => builder(table, { data: { id: 'f1', name: 'x', parent_id: null }, error: null }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'u' }, error: null }) }) },
  },
}));

import { createFolder, listImages, trashImage } from '../src/api';

beforeEach(() => { calls.length = 0; });

describe('api', () => {
  it('createFolder inserts name and parent', async () => {
    await createFolder('Invoices', 'p1');
    const ins = calls.find((c) => c.method === 'insert')!;
    expect(ins.table).toBe('folders');
    expect(ins.args[0]).toEqual({ name: 'Invoices', parent_id: 'p1' });
  });

  it('trashImage sets trashed_at instead of deleting', async () => {
    await trashImage('i1');
    expect(calls.some((c) => c.method === 'delete')).toBe(false);
    const upd = calls.find((c) => c.method === 'update')!;
    expect(Object.keys(upd.args[0] as object)).toEqual(['trashed_at']);
    expect((upd.args[0] as any).trashed_at).toBeTruthy();
  });

  it('listImages filters trashed rows by the trashed flag', async () => {
    await listImages(null, false);
    expect(calls.some((c) => c.method === 'is' && c.args[0] === 'trashed_at' && c.args[1] === null)).toBe(true);
    calls.length = 0;
    await listImages(null, true);
    expect(calls.some((c) => c.method === 'not' && c.args[0] === 'trashed_at')).toBe(true);
  });
});
