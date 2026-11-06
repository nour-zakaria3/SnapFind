import { describe, expect, it } from 'vitest';
import { validatePlan } from '../supabase/functions/agent/plan';

const ctx = {
  imageIds: new Set(['i1', 'i2']),
  folders: [{ id: 'f1', name: 'Invoices', parentId: null }, { id: 'a1', name: '2024', parentId: 'f1' }, { id: 'a2', name: '2024', parentId: null }],
  imageFolders: { i1: null, i2: 'f1' } as Record<string, string | null>,
};

describe('validatePlan', () => {
  it('rejects an unknown op', () => {
    const r = validatePlan({ ops: [{ op: 'delete_all' }] }, ctx);
    expect(r.ok).toBe(false);
  });

  it('rejects an image id not in ctx', () => {
    const r = validatePlan({ ops: [{ op: 'trash', imageId: 'zzz' }] }, ctx);
    expect(r.ok).toBe(false);
  });

  it('rejects the whole plan if any op is invalid', () => {
    const r = validatePlan({ ops: [{ op: 'trash', imageId: 'i1' }, { op: 'trash', imageId: 'nope' }] }, ctx);
    expect(r.ok).toBe(false);
  });

  it('drops create_folder when a folder with that name already exists', () => {
    const r = validatePlan({ ops: [{ op: 'create_folder', name: 'invoices', parentId: null }] }, ctx);
    expect(r).toEqual({ ok: true, ops: [] });
  });

  it('drops duplicate create_folder ops inside one plan', () => {
    const r = validatePlan({ ops: [
      { op: 'create_folder', name: 'Trips', parentId: null },
      { op: 'create_folder', name: 'trips', parentId: null },
    ] }, ctx);
    expect(r).toEqual({ ok: true, ops: [{ op: 'create_folder', name: 'Trips', parentId: null }] });
  });

  it('drops a move that targets the image current folder', () => {
    const r = validatePlan({ ops: [{ op: 'move', imageId: 'i2', folderName: 'Invoices' }] }, ctx);
    expect(r).toEqual({ ok: true, ops: [] });
  });

  it('accepts a move into a folder created earlier in the same plan', () => {
    const r = validatePlan({ ops: [
      { op: 'create_folder', name: 'Trips', parentId: null },
      { op: 'move', imageId: 'i1', folderName: 'Trips' },
    ] }, ctx);
    expect(r.ok && r.ops).toHaveLength(2);
  });

  it('rejects a move into a folder that neither exists nor is created', () => {
    const r = validatePlan({ ops: [{ op: 'move', imageId: 'i1', folderName: 'Ghost' }] }, ctx);
    expect(r.ok).toBe(false);
  });

  it('rejects renaming a folder that is not the user\'s', () => {
    const r = validatePlan({ ops: [{ op: 'rename', folderId: 'other', name: 'X' }] }, ctx);
    expect(r.ok).toBe(false);
  });

  it('accepts a question with no ops', () => {
    const r = validatePlan({ question: 'Which photos?' }, ctx);
    expect(r).toEqual({ ok: true, ops: [], question: 'Which photos?' });
  });

  it('rejects non-object input', () => {
    expect(validatePlan('hello', ctx).ok).toBe(false);
  });

  it('rejects a move to a folder name shared by two existing folders (ambiguous)', () => {
    const r = validatePlan({ ops: [{ op: 'move', imageId: 'i1', folderName: '2024' }] }, ctx);
    expect(r.ok).toBe(false);
  });

  it('allows a folder created inside another folder created earlier in the plan', () => {
    const r = validatePlan({ ops: [
      { op: 'create_folder', name: 'Work', parentId: null },
      { op: 'create_folder', name: 'Q1', parentId: null, parentName: 'Work' },
    ] }, ctx);
    expect(r.ok && r.ops).toHaveLength(2);
  });

  it('keeps same-named folders under different parents', () => {
    const r = validatePlan({ ops: [{ op: 'create_folder', name: '2024', parentId: 'f1' }] }, ctx);
    expect(r).toEqual({ ok: true, ops: [] }); // exists under f1
    const r2 = validatePlan({ ops: [{ op: 'create_folder', name: '2023', parentId: 'f1' }, { op: 'create_folder', name: '2023', parentId: null }] }, ctx);
    expect(r2.ok && r2.ops).toHaveLength(2);
  });

  it('skips renaming a folder to its current name and rejects a name collision', () => {
    expect(validatePlan({ ops: [{ op: 'rename', folderId: 'f1', name: 'invoices' }] }, ctx)).toEqual({ ok: true, ops: [] });
    expect(validatePlan({ ops: [{ op: 'rename', folderId: 'f1', name: '2024' }] }, ctx).ok).toBe(false);
  });

  it('lets a move target a folder renamed earlier in the plan', () => {
    const r = validatePlan({ ops: [{ op: 'rename', folderId: 'f1', name: 'Bills' }, { op: 'move', imageId: 'i1', folderName: 'Bills' }] }, ctx);
    expect(r.ok && r.ops).toHaveLength(2);
  });

  it('caps a plan at 100 ops and 20 trashes', () => {
    const many = Array.from({ length: 21 }, () => ({ op: 'trash', imageId: 'i1' }));
    expect(validatePlan({ ops: many }, ctx).ok).toBe(false);
    const ids = new Set(Array.from({ length: 101 }, (_, i) => `x${i}`));
    const big = [...ids].map((imageId) => ({ op: 'move', imageId, folderName: 'Invoices' }));
    expect(validatePlan({ ops: big }, { ...ctx, imageIds: ids, imageFolders: {} }).ok).toBe(false);
  });
});
