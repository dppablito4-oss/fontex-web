import { canvasCacheKey, lastMaterial, listMaterials, loadMaterial } from "./native-document-store";
import { CANVAS_WORKSPACE_ID, CANVAS_WORKSPACE_FORMAT, MAX_CANVAS_WORKSPACE_BYTES, isCanvasWorkspace } from "../../core/scene/formats";
import { parseDocument, uid, type StudioDocument } from "../../core/document-schema/document";
import type { ConversationTurn } from "../../core/agent/conversation";
export type Workspace = { activeId: string | null; documents: StudioDocument[]; conversations: Record<string, ConversationTurn[]> };
export const workspaceEvent = "fontex-canvas-change";
export const chatKey = (owner: string) => `fontex-canvas-chat-v1:${owner}`;
export const revisionKey = (owner: string) => `fontex-canvas-sync-v1:${owner}`;
export function workspaceScene(state: Workspace) {
  const scene = { id: CANVAS_WORKSPACE_ID, version: 1, format: CANVAS_WORKSPACE_FORMAT, state: parseWorkspace(state) };
  // Pretty JSON is a conservative upper bound for the jsonb text stored by Postgres.
  if (new TextEncoder().encode(JSON.stringify(scene, null, 2)).byteLength > MAX_CANVAS_WORKSPACE_BYTES) throw new Error("Tu espacio supera los 2 MiB. Exporta o elimina materiales para sincronizar.");
  return scene;
}
export function parseWorkspaceScene(value: unknown): Workspace {
  if (!isCanvasWorkspace(value) || !value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("state" in value)) throw new Error("Espacio remoto del lienzo inválido.");
  return parseWorkspace(value.state);
}
export function parseConversations(value: unknown): Record<string, ConversationTurn[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Historial inválido.");
  const entries = Object.entries(value);
  if (entries.length > 100) throw new Error("Demasiadas conversaciones.");
  return Object.fromEntries(entries.map(([id, turns]: [string, unknown]) => {
    if (!Array.isArray(turns) || turns.length > 80 || !turns.every((turn: unknown) => !!turn && typeof turn === "object" && "role" in turn && (turn.role === "user" || turn.role === "assistant") && "content" in turn && typeof turn.content === "string" && turn.content.length > 0 && turn.content.length <= 4000)) throw new Error("Historial inválido.");
    return [id, turns.map(turn => ({ role: (turn as ConversationTurn).role, content: (turn as ConversationTurn).content }))];
  }));
}
export function parseWorkspace(value: unknown): Workspace {
  if (!value || typeof value !== "object" || !("documents" in value) || !Array.isArray(value.documents) || value.documents.length > 100 || !("activeId" in value) || !("conversations" in value)) throw new Error("Espacio inválido.");
  const documents = value.documents.map(parseDocument), conversations = parseConversations(value.conversations);
  if (new Set(documents.map(d => d.id)).size !== documents.length || (value.activeId !== null && !documents.some(d => d.id === value.activeId))) throw new Error("Espacio incompleto.");
  return { activeId: value.activeId as string | null, documents, conversations: Object.fromEntries(documents.map(d => [d.id, conversations[d.id] ?? []])) };
}
export function readWorkspace(owner: string): Workspace {
  const saved = localStorage.getItem(canvasCacheKey(owner));
  if (saved === null) {
    const documents = listMaterials(localStorage, owner).map(item => loadMaterial(localStorage, owner, item.id));
    const active = lastMaterial(localStorage, owner);
    if (active && !documents.some(item => item.id === active.id)) documents.unshift(active);
    return parseWorkspace({ activeId: active?.id ?? null, documents, conversations: JSON.parse(localStorage.getItem(chatKey(owner)) ?? "{}") as unknown });
  }
  const raw: unknown = JSON.parse(saved ?? '{"activeId":null,"documents":[]}');
  if (!raw || typeof raw !== "object" || !("documents" in raw) || !("activeId" in raw)) throw new Error("No se pudo leer tu espacio local.");
  return parseWorkspace({ documents: raw.documents, activeId: raw.activeId, conversations: JSON.parse(localStorage.getItem(chatKey(owner)) ?? "{}") as unknown });
}
export function writeWorkspace(owner: string, state: Workspace) {
  const oldChat = localStorage.getItem(chatKey(owner));
  localStorage.setItem(chatKey(owner), JSON.stringify(state.conversations));
  try { localStorage.setItem(canvasCacheKey(owner), JSON.stringify({ version: 1, activeId: state.activeId, documents: state.documents })); }
  catch (error) { if (oldChat === null) localStorage.removeItem(chatKey(owner)); else localStorage.setItem(chatKey(owner), oldChat); throw error; }
}
export const sameWorkspace = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export async function workspaceHash(state: Workspace) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(state)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
/** Three-way merge: concurrent edits keep a local copy instead of overwriting either device. */
export function mergeWorkspaces(base: Workspace | null, local: Workspace, remote: Workspace) {
  if (base && sameWorkspace(local, base)) return { state: remote, copies: 0 };
  if (base && sameWorkspace(remote, base)) return { state: local, copies: 0 };
  const documents: StudioDocument[] = [], conversations: Workspace["conversations"] = {};
  let activeId = base && local.activeId === base.activeId ? remote.activeId : local.activeId ?? remote.activeId;
  let copies = 0;
  const bundle = (state: Workspace | null, id: string) => {
    const document = state?.documents.find(d => d.id === id);
    return document ? { document, chat: state?.conversations[id] ?? [] } : undefined;
  };
  const ids = new Set([...local.documents.map(d => d.id), ...remote.documents.map(d => d.id), ...(base?.documents.map(d => d.id) ?? [])]);
  for (const id of ids) {
    const l = bundle(local, id), r = bundle(remote, id), b = bundle(base, id);
    let chosen: ReturnType<typeof bundle>;
    if (sameWorkspace(l, r)) chosen = l;
    else if (base && sameWorkspace(l, b)) chosen = r;
    else if (base && sameWorkspace(r, b)) chosen = l;
    else if (l && r) {
      chosen = r;
      const copy = { ...l.document, id: uid(), title: `${l.document.title.slice(0, 100)} (copia local)` };
      documents.push(copy); conversations[copy.id] = l.chat; copies++;
      if (activeId === id) activeId = copy.id;
    } else if (l && !r && b) {
      const copy = { ...l.document, id: uid(), title: `${l.document.title.slice(0, 100)} (copia local)` };
      documents.push(copy); conversations[copy.id] = l.chat; copies++;
      if (activeId === id) activeId = copy.id;
      chosen = undefined;
    } else chosen = l ?? r;
    if (chosen) { documents.push(chosen.document); conversations[chosen.document.id] = chosen.chat; }
  }
  if (!documents.some(d => d.id === activeId)) activeId = documents[0]?.id ?? null;
  return { state: parseWorkspace({ activeId, documents, conversations }), copies };
}
