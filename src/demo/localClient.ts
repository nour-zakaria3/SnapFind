// A tiny in-browser stand-in for the parts of the Supabase client this app uses.
// Used for demo mode: nothing leaves the browser. Data persists in IndexedDB.

type Row = Record<string, any>;
interface Opts { persist?: boolean }

const DEFAULTS: Record<string, () => Row> = {
  folders: () => ({ parent_id: null }),
  images: () => ({ folder_id: null, ocr_text: '', embedding: null, status: 'pending', trashed_at: null }),
};

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('image-archive-demo', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('tables');
      req.result.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const idbGet = (db: IDBDatabase, store: string, key: string) =>
  new Promise<any>((res) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
const idbPut = (db: IDBDatabase, store: string, key: string, val: unknown) =>
  new Promise<void>((res) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); tx.oncomplete = () => res(); tx.onerror = () => res(); });
const idbDel = (db: IDBDatabase, store: string, key: string) =>
  new Promise<void>((res) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete = () => res(); tx.onerror = () => res(); });

export function createLocalClient(opts: Opts = {}) {
  const persist = opts.persist !== false && typeof indexedDB !== 'undefined';
  const tables: Record<string, Row[]> = { folders: [], images: [] };
  const blobs = new Map<string, Blob>();
  let db: IDBDatabase | null = null;
  const ready = (async () => {
    if (!persist) return;
    db = await idb();
    for (const name of Object.keys(tables)) tables[name] = (await idbGet(db, 'tables', name)) ?? [];
  })();
  const save = async (name: string) => { if (db) await idbPut(db, 'tables', name, tables[name]); };

  function query(table: string) {
    type Op = (rows: Row[]) => Row[];
    const filters: ((r: Row) => boolean)[] = [];
    let mode: 'select' | 'insert' | 'update' = 'select';
    let payload: Row = {};
    let order: { col: string; asc: boolean } | null = null;
    let single = false;

    const run = async () => {
      await ready;
      const rows = tables[table];
      const match = (r: Row) => filters.every((f) => f(r));
      let result: Row[];
      if (mode === 'insert') {
        const row = { id: crypto.randomUUID(), user_id: 'demo', created_at: new Date().toISOString(), ...(DEFAULTS[table]?.() ?? {}), ...payload };
        rows.push(row);
        await save(table);
        result = [row];
      } else if (mode === 'update') {
        result = rows.filter(match);
        result.forEach((r) => Object.assign(r, payload));
        await save(table);
      } else {
        result = rows.filter(match);
      }
      if (order) {
        const { col, asc } = order;
        result = [...result].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      }
      if (single) return { data: result[0] ?? null, error: result[0] ? null : { message: 'not found' } };
      return { data: result.map((r) => ({ ...r })), error: null };
    };

    const q: any = {
      select: () => q,
      insert: (row: Row) => { mode = 'insert'; payload = row; return q; },
      update: (row: Row) => { mode = 'update'; payload = row; return q; },
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      is: (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return q; },
      not: (c: string, _op: string, v: unknown) => { filters.push((r) => (r[c] ?? null) !== v); return q; },
      in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return q; },
      order: (col: string, o?: { ascending?: boolean }) => { order = { col, asc: o?.ascending !== false }; return q; },
      limit: () => q,
      single: () => { single = true; return q; },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
    };
    return q;
  }

  const cosine = (a: number[], b: number[]) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * (b[i] ?? 0);
    return s; // vectors are L2-normalized by the app
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'demo' } }, error: null }),
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => query(table),
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, blob: Blob) => {
          blobs.set(path, blob);
          if (db) await idbPut(db, 'blobs', path, blob);
          return { error: null };
        },
        download: async (path: string) => {
          await ready;
          const b = blobs.get(path) ?? (db ? await idbGet(db, 'blobs', path) : undefined);
          if (b) blobs.set(path, b);
          return b ? { data: b as Blob, error: null } : { data: null, error: { message: 'not found' } };
        },
        createSignedUrl: async (path: string) => {
          await ready;
          const b = blobs.get(path) ?? (db ? await idbGet(db, 'blobs', path) : undefined);
          if (!b) return { data: null, error: { message: 'not found' } };
          return { data: { signedUrl: URL.createObjectURL(b) }, error: null };
        },
        remove: async (paths: string[]) => {
          for (const p of paths) { blobs.delete(p); if (db) await idbDel(db, 'blobs', p); }
          return { error: null };
        },
      }),
    },
    rpc: async (name: string, args: { query_embedding: string | null; query_text: string; match_count?: number }) => {
      if (name !== 'search_images') return { data: null, error: { message: 'unknown rpc' } };
      await ready;
      const emb: number[] | null = args.query_embedding ? JSON.parse(args.query_embedding) : null;
      const text = (args.query_text ?? '').toLowerCase();
      const scored = tables.images
        .filter((i) => !i.trashed_at)
        .map((i) => {
          const sim = emb && i.embedding ? cosine(i.embedding, emb) : 0;
          const txt = text !== '' && String(i.ocr_text ?? '').toLowerCase().includes(text);
          return { id: i.id as string, score: Math.max(sim, txt ? 1 : 0), keep: txt || sim > 0.15 };
        })
        .filter((r) => r.keep)
        .sort((a, b) => b.score - a.score)
        .slice(0, args.match_count ?? 40)
        .map(({ id, score }) => ({ id, score }));
      return { data: scored, error: null };
    },
    functions: {
      invoke: async (_name: string, _o: { body: unknown }) => ({ data: { error: 'demo' }, error: null }),
    },
  };
}
