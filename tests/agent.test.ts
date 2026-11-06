import { beforeEach, describe, expect, it, vi } from 'vitest';

const { log, api } = vi.hoisted(() => { const log: string[] = []; const api = {
  listFolders: vi.fn(async () => [{ id: 'f1', name: 'Invoices', parent_id: null }]),
  createFolder: vi.fn(async (name: string) => { log.push(`create:${name}`); return { id: `new-${name}`, name, parent_id: null }; }),
  moveImage: vi.fn(async (id: string, folder: string | null) => { log.push(`move:${id}:${folder}`); }),
  renameFolder: vi.fn(async (id: string, name: string) => { log.push(`rename:${id}:${name}`); }),
  trashImage: vi.fn(async (id: string) => { log.push(`trash:${id}`); }),
  deleteImage: vi.fn(),
}; return { log, api }; });
vi.mock('../src/api', () => api);
vi.mock('../src/agentClient', () => ({ callAgent: vi.fn() }));

import { executePlan } from '../src/agent';

beforeEach(() => { log.length = 0; vi.clearAllMocks(); });

describe('executePlan', () => {
  it('creates the folder before moving images into it', async () => {
    const r = await executePlan([
      { op: 'create_folder', name: 'Trips', parentId: null },
      { op: 'move', imageId: 'i1', folderName: 'Trips' },
    ]);
    expect(log).toEqual(['create:Trips', 'move:i1:new-Trips']);
    expect(r.failed).toBeNull();
  });

  it('moves into an existing folder matched case-insensitively', async () => {
    await executePlan([{ op: 'move', imageId: 'i1', folderName: 'invoices' }]);
    expect(log).toEqual(['move:i1:f1']);
  });

  it('stops at first failure and reports remaining ops', async () => {
    api.moveImage.mockRejectedValueOnce(new Error('denied'));
    const r = await executePlan([
      { op: 'move', imageId: 'i1', folderName: 'Invoices' },
      { op: 'trash', imageId: 'i2' },
    ]);
    expect(r.done).toBe(0);
    expect(r.failed).toEqual({ index: 0, message: 'denied' });
    expect(r.remaining).toBe(2);
    expect(log).not.toContain('trash:i2');
  });

  it('trash op calls trashImage, never a delete', async () => {
    await executePlan([{ op: 'trash', imageId: 'i1' }]);
    expect(api.trashImage).toHaveBeenCalledWith('i1');
    expect(api.deleteImage).not.toHaveBeenCalled();
  });

  it('creates a subfolder under a parent created earlier in the same plan', async () => {
    await executePlan([
      { op: 'create_folder', name: 'Work', parentId: null },
      { op: 'create_folder', name: 'Q1', parentId: null, parentName: 'Work' },
    ]);
    expect(api.createFolder).toHaveBeenLastCalledWith('Q1', 'new-Work');
  });
});
