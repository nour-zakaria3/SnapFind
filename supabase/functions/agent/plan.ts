// Pure validation of an agent plan. No network, no Deno APIs, so it is unit-tested with vitest.

export type Operation =
  | { op: 'create_folder'; name: string; parentId: string | null; parentName?: string }
  | { op: 'move'; imageId: string; folderName: string }
  | { op: 'rename'; folderId: string; name: string }
  | { op: 'trash'; imageId: string };

export interface PlanContext {
  imageIds: Set<string>;
  folders: { id: string; name: string; parentId?: string | null }[];
  /** Current folder id of each image (null = no folder). */
  imageFolders: Record<string, string | null>;
}

export type PlanResult =
  | { ok: true; ops: Operation[]; question?: string }
  | { ok: false; reason: string };

export const MAX_OPS = 100;
export const MAX_TRASH = 20;

const norm = (s: string) => s.normalize('NFKC').replace(/\u0640/g, '').trim().toLowerCase();
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

interface VFolder { id: string | null; name: string; parent: string | null }

export function validatePlan(raw: unknown, ctx: PlanContext): PlanResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'plan is not an object' };
  const input = raw as { ops?: unknown; question?: unknown };

  if (typeof input.question === 'string' && input.question.trim() && !input.ops) {
    return { ok: true, ops: [], question: input.question };
  }
  if (!Array.isArray(input.ops)) return { ok: false, reason: 'missing ops' };
  if (input.ops.length > MAX_OPS) return { ok: false, reason: 'too many operations' };

  // Virtual folder tree: real folders plus ones this plan creates; parent is an id or "new:<name>".
  const folders: VFolder[] = ctx.folders.map((f) => ({ id: f.id, name: f.name, parent: f.parentId ?? null }));
  const refOf = (f: VFolder) => f.id ?? `new:${norm(f.name)}`;
  const byName = (name: string) => folders.filter((f) => norm(f.name) === norm(name));
  const out: Operation[] = [];
  let trashes = 0;

  for (const item of input.ops as Record<string, unknown>[]) {
    switch (item?.op) {
      case 'create_folder': {
        if (!isStr(item.name)) return { ok: false, reason: 'create_folder needs a name' };
        let parent: string | null = null;
        let parentName: string | undefined;
        if (isStr(item.parentName)) {
          const c = byName(item.parentName);
          if (c.length === 0) return { ok: false, reason: `parent "${item.parentName}" does not exist` };
          if (c.length > 1) return { ok: false, reason: `parent "${item.parentName}" is ambiguous` };
          parent = refOf(c[0]);
          parentName = item.parentName.trim();
        } else if (item.parentId != null) {
          if (typeof item.parentId !== 'string' || !ctx.folders.some((f) => f.id === item.parentId)) {
            return { ok: false, reason: 'unknown parent folder' };
          }
          parent = item.parentId;
        }
        if (folders.some((f) => norm(f.name) === norm(item.name as string) && f.parent === parent)) break; // already there
        folders.push({ id: null, name: item.name.trim(), parent });
        out.push({ op: 'create_folder', name: item.name.trim(), parentId: parentName ? null : parent, ...(parentName ? { parentName } : {}) });
        break;
      }
      case 'move': {
        if (!isStr(item.imageId) || !ctx.imageIds.has(item.imageId)) return { ok: false, reason: 'unknown image' };
        if (!isStr(item.folderName)) return { ok: false, reason: 'move needs folderName' };
        const c = byName(item.folderName);
        if (c.length === 0) return { ok: false, reason: `folder "${item.folderName}" does not exist` };
        if (c.length > 1) return { ok: false, reason: `folder name "${item.folderName}" is ambiguous` };
        if (c[0].id && ctx.imageFolders[item.imageId] === c[0].id) break; // no-op
        out.push({ op: 'move', imageId: item.imageId, folderName: item.folderName.trim() });
        break;
      }
      case 'rename': {
        const f = folders.find((x) => x.id === item.folderId);
        if (!isStr(item.folderId) || !f) return { ok: false, reason: 'unknown folder' };
        if (!isStr(item.name)) return { ok: false, reason: 'rename needs a name' };
        if (norm(f.name) === norm(item.name)) break; // no-op
        if (folders.some((x) => x !== f && x.parent === f.parent && norm(x.name) === norm(item.name as string))) {
          return { ok: false, reason: `a folder named "${item.name}" already exists there` };
        }
        f.name = item.name.trim();
        out.push({ op: 'rename', folderId: item.folderId, name: item.name.trim() });
        break;
      }
      case 'trash': {
        if (!isStr(item.imageId) || !ctx.imageIds.has(item.imageId)) return { ok: false, reason: 'unknown image' };
        if (++trashes > MAX_TRASH) return { ok: false, reason: 'too many images to trash at once' };
        out.push({ op: 'trash', imageId: item.imageId });
        break;
      }
      default:
        return { ok: false, reason: `unsupported op: ${String(item?.op)}` };
    }
  }
  return { ok: true, ops: out };
}
