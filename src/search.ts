import { listImagesByIds } from './api';
import { translateToEnglish } from './agentClient';
import { embedText } from './imaging/embed';
import { supabase } from './supabase';
import type { ImageRow } from './types';

const ARABIC = /[؀-ۿ]/;

export async function searchImages(query: string): Promise<ImageRow[]> {
  const q = query.trim();
  if (!q) return [];

  // CLIP understands English far better than Arabic. Translate first; if translation or the
  // embedding model is unavailable, fall back to plain text search (no vector term).
  let embedding: number[] | null = null;
  try {
    const forEmbedding = ARABIC.test(q) ? await translateToEnglish(q) : q;
    if (forEmbedding) embedding = await embedText(forEmbedding);
  } catch {
    embedding = null;
  }

  const { data, error } = await supabase.rpc('search_images', {
    query_embedding: embedding ? JSON.stringify(embedding) : null,
    query_text: q,
    match_count: 40,
  });
  if (error) throw new Error(error.message);
  const ids = (data as { id: string }[]).map((r) => r.id);
  const rows = await listImagesByIds(ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is ImageRow => !!r);
}
