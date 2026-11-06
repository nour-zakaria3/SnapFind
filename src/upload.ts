import { embedImage } from './imaging/embed';
import { extractText } from './imaging/ocr';
import { resizeImage } from './imaging/resize';
import { downloadBlob, insertPending, listPending, markIndexed, removeBlob, uploadBlob } from './storageApi';

export interface UploadFailure {
  name: string;
  message: string;
}

export type ProgressFn = (done: number, total: number, failed: UploadFailure[]) => void;

async function index(id: string, blob: Blob): Promise<void> {
  const [text, embedding] = await Promise.all([extractText(blob), embedImage(blob)]);
  await markIndexed(id, text, embedding);
}

export async function uploadImages(
  files: File[],
  folderId: string | null,
  onProgress: ProgressFn,
): Promise<void> {
  const failed: UploadFailure[] = [];
  let done = 0;
  for (const file of files) {
    try {
      const blob = await resizeImage(file);
      const id = crypto.randomUUID();
      const path = await uploadBlob(id, blob);
      try {
        await insertPending(path, folderId, id);
      } catch (e) {
        await removeBlob(path).catch(() => {});
        throw e;
      }
      try {
        await index(id, blob);
      } catch {
        /* stays 'pending'; retryPending() will try again */
      }
    } catch (e) {
      failed.push({ name: file.name, message: (e as Error).message });
    }
    done++;
    onProgress(done, files.length, [...failed]);
  }
}

export async function retryPending(): Promise<void> {
  for (const row of await listPending()) {
    try {
      await index(row.id, await downloadBlob(row.storage_path));
    } catch {
      /* leave pending */
    }
  }
}
