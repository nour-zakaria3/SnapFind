import { supabase } from './supabase';

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('not signed in');
  return data.user.id;
}

/** Uploads to `<user_id>/<image_id>.jpg` and returns the storage path. */
export async function uploadBlob(imageId: string, blob: Blob): Promise<string> {
  const path = `${await uid()}/${imageId}.jpg`;
  const { error } = await supabase.storage.from('images').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return path;
}

export async function insertPending(storagePath: string, folderId: string | null, id: string): Promise<string> {
  const { error } = await supabase
    .from('images')
    .insert({ id, storage_path: storagePath, folder_id: folderId, status: 'pending' });
  if (error) throw new Error(error.message);
  return id;
}

export async function markIndexed(id: string, ocrText: string, embedding: number[]): Promise<void> {
  const { error } = await supabase
    .from('images')
    .update({ ocr_text: ocrText, embedding: JSON.stringify(embedding), status: 'indexed' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listPending(): Promise<{ id: string; storage_path: string }[]> {
  const { data, error } = await supabase.from('images').select('id,storage_path').eq('status', 'pending');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function downloadBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from('images').download(path);
  if (error || !data) throw new Error(error?.message ?? 'download failed');
  return data;
}

export async function removeBlob(path: string): Promise<void> {
  await supabase.storage.from('images').remove([path]);
}
