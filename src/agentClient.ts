import { supabase } from './supabase';

/** Calls the `agent` Edge Function. Returns null on any failure. */
export async function callAgent<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke('agent', { body });
    if (error) return null;
    return data as T;
  } catch {
    return null;
  }
}

export async function translateToEnglish(text: string): Promise<string | null> {
  const res = await callAgent<{ text?: string; error?: string }>({ action: 'translate', text });
  return res?.text ?? null;
}
