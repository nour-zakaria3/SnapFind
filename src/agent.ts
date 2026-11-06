import { createFolder, listFolders, moveImage, renameFolder, trashImage } from './api';
import { callAgent } from './agentClient';
import type { Operation } from '../supabase/functions/agent/plan';

export type { Operation };

export type PlanResponse =
  | { ops: Operation[]; question?: string }
  | { error: 'quota' | 'failed' | 'invalid_plan'; reason?: string };

export async function requestPlan(command: string): Promise<PlanResponse> {
  const res = await callAgent<PlanResponse>({ action: 'plan', command });
  return res ?? { error: 'failed' };
}

export interface ExecResult {
  done: number;
  remaining: number;
  failed: { index: number; message: string } | null;
}

export async function executePlan(ops: Operation[]): Promise<ExecResult> {
  const folderIds = new Map<string, string>();
  for (const f of await listFolders()) folderIds.set(f.name.trim().toLowerCase(), f.id);

  let done = 0;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    try {
      switch (op.op) {
        case 'create_folder': {
          let parentId = op.parentId;
          if (op.parentName) {
            parentId = folderIds.get(op.parentName.trim().toLowerCase()) ?? null;
            if (!parentId) throw new Error(`parent "${op.parentName}" not found`);
          }
          const f = await createFolder(op.name, parentId);
          folderIds.set(op.name.trim().toLowerCase(), f.id);
          break;
        }
        case 'move': {
          const id = folderIds.get(op.folderName.trim().toLowerCase());
          if (!id) throw new Error(`folder "${op.folderName}" not found`);
          await moveImage(op.imageId, id);
          break;
        }
        case 'rename':
          await renameFolder(op.folderId, op.name);
          break;
        case 'trash':
          await trashImage(op.imageId);
          break;
      }
      done++;
    } catch (e) {
      return { done, remaining: ops.length - done, failed: { index: i, message: (e as Error).message } };
    }
  }
  return { done, remaining: 0, failed: null };
}
