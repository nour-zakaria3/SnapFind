import { supabase } from './supabase';
import type { Folder, ImageRow } from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function listFolders(): Promise<Folder[]> {
  const res = await supabase.from('folders').select('id,name,parent_id').order('name');
  return check(res) ?? [];
}

export async function createFolder(name: string, parentId: string | null): Promise<Folder> {
  const res = await supabase
    .from('folders')
    .insert({ name, parent_id: parentId })
    .select('id,name,parent_id')
    .single();
  return check(res);
}

export async function renameFolder(id: string, name: string): Promise<void> {
  check(await supabase.from('folders').update({ name }).eq('id', id));
}

export async function listImages(folderId: string | null, trashed: boolean): Promise<ImageRow[]> {
  let q: any = supabase
    .from('images')
    .select('id,storage_path,folder_id,ocr_text,status,trashed_at,created_at');
  q = trashed ? q.not('trashed_at', 'is', null) : q.is('trashed_at', null);
  if (!trashed && folderId) q = q.eq('folder_id', folderId);
  q = q.order('created_at', { ascending: false });
  return check(await q) ?? [];
}

export async function moveImage(id: string, folderId: string | null): Promise<void> {
  check(await supabase.from('images').update({ folder_id: folderId }).eq('id', id));
}

export async function trashImage(id: string): Promise<void> {
  check(await supabase.from('images').update({ trashed_at: new Date().toISOString() }).eq('id', id));
}

export async function restoreImage(id: string): Promise<void> {
  check(await supabase.from('images').update({ trashed_at: null }).eq('id', id));
}

export async function signedUrl(path: string): Promise<string> {
  const res = await supabase.storage.from('images').createSignedUrl(path, 3600);
  return (check(res) as { signedUrl: string }).signedUrl;
}

/** Fetches rows by id and returns them in the order of `ids`. */
export async function listImagesByIds(ids: string[]): Promise<ImageRow[]> {
  if (ids.length === 0) return [];
  const res = await supabase
    .from('images')
    .select('id,storage_path,folder_id,ocr_text,status,trashed_at,created_at')
    .in('id', ids);
  const rows = (check(res) ?? []) as ImageRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is ImageRow => !!r);
}
