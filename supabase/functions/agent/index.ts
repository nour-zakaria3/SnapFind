// Supabase Edge Function (Deno). Deploy: supabase functions deploy agent
// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional), ALLOWED_ORIGIN (your GitHub Pages origin).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validatePlan } from './plan.ts';

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'null'; // fail closed: set ALLOWED_ORIGIN

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function gemini(system: string, user: string): Promise<{ text?: string; quota?: boolean }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY') ?? '' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    },
  );
  if (res.status === 429) return { quota: true };
  if (!res.ok) return {};
  const data = await res.json();
  return { text: data?.candidates?.[0]?.content?.parts?.[0]?.text };
}

const PLAN_SYSTEM = `You organize a user's image library. Reply with JSON only, in one of two shapes:
{"ops":[...]} or {"question":"..."} (ask a question only if the command is ambiguous).
Allowed ops (nothing else):
{"op":"create_folder","name":string,"parentId":string|null}
{"op":"move","imageId":string,"folderName":string}   // folderName must exist or be created earlier in ops
{"op":"rename","folderId":string,"name":string}
{"op":"trash","imageId":string}
Use only the image ids and folder ids given. Never invent ids. Images are described by OCR text, which may be empty.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'unauthorized' }, 401);

  let body: { action?: string; command?: string; text?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  if (body.action === 'translate') {
    if (!body.text || body.text.length > 500) return json({ error: 'bad text' }, 400);
    const r = await gemini(
      'Translate the user text into short natural English for an image search. Reply JSON: {"text": string}.',
      body.text,
    );
    if (r.quota) return json({ error: 'quota' });
    try { return json({ text: JSON.parse(r.text ?? '').text }); } catch { return json({ error: 'failed' }); }
  }

  if (body.action === 'plan') {
    if (!body.command || body.command.length > 1000) return json({ error: 'bad command' }, 400);
    // RLS limits both queries to the caller's own rows.
    const [{ data: images, error: e1 }, { data: folders, error: e2 }] = await Promise.all([
      supabase.from('images').select('id,ocr_text,folder_id').is('trashed_at', null).limit(500),
      supabase.from('folders').select('id,name,parent_id'),
    ]);
    if (e1 || e2) return json({ error: 'failed' });
    const ctx = {
      imageIds: new Set((images ?? []).map((i) => i.id)),
      folders: (folders ?? []).map((f) => ({ id: f.id, name: f.name, parentId: f.parent_id })),
      imageFolders: Object.fromEntries((images ?? []).map((i) => [i.id, i.folder_id])),
    };
    const prompt = JSON.stringify({
      command: body.command,
      folders: ctx.folders,
      images: (images ?? []).map((i) => ({ id: i.id, folderId: i.folder_id, text: (i.ocr_text ?? '').slice(0, 200) })),
    });
    const r = await gemini(PLAN_SYSTEM, prompt);
    if (r.quota) return json({ error: 'quota' });
    let raw: unknown;
    try { raw = JSON.parse(r.text ?? ''); } catch { return json({ error: 'failed' }); }
    const result = validatePlan(raw, ctx);
    if (!result.ok) return json({ error: 'invalid_plan', reason: result.reason });
    return json({ ops: result.ops, question: result.question });
  }

  return json({ error: 'unknown action' }, 400);
});
