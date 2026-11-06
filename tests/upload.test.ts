import { beforeEach, describe, expect, it, vi } from 'vitest';

const rows = new Map<string, { status: string; ocr_text: string; embedding: number[] | null }>();

vi.mock('../src/imaging/resize', async () => {
  const actual = await vi.importActual<typeof import('../src/imaging/resize')>('../src/imaging/resize');
  return { ...actual, resizeImage: vi.fn(async (f: File) => { actual.validateImageFile(f); return new Blob(['x']); }) };
});
const extractText = vi.fn(async (_b?: Blob) => 'hello');
const embedImage = vi.fn(async (_b?: Blob) => [0.1, 0.2]);
vi.mock('../src/imaging/ocr', () => ({ extractText: (b: Blob) => extractText(b) }));
vi.mock('../src/imaging/embed', () => ({ embedImage: (b: Blob) => embedImage(b) }));

vi.mock('../src/storageApi', () => ({
  uploadBlob: vi.fn(async () => 'u/path.jpg'),
  insertPending: vi.fn(async (_path: string, _folder: string | null, id: string) => { rows.set(id, { status: 'pending', ocr_text: '', embedding: null }); return id; }),
  markIndexed: vi.fn(async (id: string, text: string, emb: number[]) => { rows.set(id, { status: 'indexed', ocr_text: text, embedding: emb }); }),
  listPending: vi.fn(async () => [...rows.entries()].filter(([, r]) => r.status === 'pending').map(([id]) => ({ id, storage_path: `u/${id}.jpg` }))),
  downloadBlob: vi.fn(async () => new Blob(['x'])),
  removeBlob: vi.fn(async () => {}),
}));

import { retryPending, uploadImages } from '../src/upload';
import * as storageApi from '../src/storageApi';

const img = (n = 'a.jpg') => new File([new Uint8Array(10)], n, { type: 'image/jpeg' });
beforeEach(() => { rows.clear(); extractText.mockClear(); embedImage.mockClear();
  extractText.mockImplementation(async () => 'hello'); embedImage.mockImplementation(async () => [0.1, 0.2]); });

describe('upload', () => {
  it('continues the batch after one invalid file', async () => {
    const bad = new File(['txt'], 'x.jpg', { type: 'text/plain' });
    const progress = vi.fn();
    await uploadImages([img('1.jpg'), bad, img('2.jpg')], null, progress);
    expect([...rows.values()].filter((r) => r.status === 'indexed')).toHaveLength(2);
    const last = progress.mock.calls.at(-1)!;
    expect(last[0]).toBe(3);
    expect(last[2]).toHaveLength(1);
  });

  it('leaves status pending when embedding throws', async () => {
    embedImage.mockImplementation(async () => { throw new Error('boom'); });
    await uploadImages([img()], null, () => {});
    expect([...rows.values()][0].status).toBe('pending');
  });

  it('retryPending marks rows indexed', async () => {
    embedImage.mockImplementationOnce(async () => { throw new Error('boom'); });
    await uploadImages([img()], null, () => {});
    await retryPending();
    expect([...rows.values()][0].status).toBe('indexed');
  });

  it('image with empty OCR text is still indexed', async () => {
    extractText.mockImplementation(async () => '');
    await uploadImages([img()], null, () => {});
    const r = [...rows.values()][0];
    expect(r.status).toBe('indexed');
    expect(r.ocr_text).toBe('');
  });

  it('removes the uploaded object when inserting the row fails', async () => {
    (storageApi.insertPending as any).mockRejectedValueOnce(new Error('db down'));
    const progress = vi.fn();
    await uploadImages([img()], null, progress);
    expect(storageApi.removeBlob).toHaveBeenCalledWith('u/path.jpg');
    expect(progress.mock.calls.at(-1)![2]).toHaveLength(1);
  });
});
