import { beforeEach, expect, it } from "vitest";
import { createDocument } from "../../core/object-registry/registry";
import { mergeWorkspaces, parseWorkspace, readWorkspace, sameWorkspace, workspaceHash, writeWorkspace, type Workspace } from "./workspace-sync";
beforeEach(() => localStorage.clear());
function workspace(): Workspace { const d = createDocument("blank"); return { activeId: d.id, documents: [d], conversations: { [d.id]: [{ role: "user", content: "Un hexágono" }] } }; }
it("recovers a cloud workspace on a fresh device including its chat", () => {
  const remote = workspace(), local: Workspace = { activeId: null, documents: [], conversations: {} };
  const merged = mergeWorkspaces(null, local, remote);
  writeWorkspace("user-a", merged.state);
  expect(readWorkspace("user-a")).toEqual(remote);
  expect(readWorkspace("user-b").documents).toEqual([]);
});
it("keeps concurrent edits and chats as separate materials without overwriting either", () => {
  const base = workspace(), id = base.activeId!, local = structuredClone(base), remote = structuredClone(base);
  local.documents[0]!.title = "Desde el teléfono"; local.conversations[id]!.push({ role: "assistant", content: "Respuesta local" });
  remote.documents[0]!.title = "Desde el PC";
  const merged = mergeWorkspaces(base, local, remote);
  expect(merged.copies).toBe(1);
  expect(merged.state.documents.find(d => d.id === id)?.title).toBe("Desde el PC");
  const copy = merged.state.documents.find(d => d.id !== id)!;
  expect(copy.title).toContain("Desde el teléfono");
  expect(merged.state.activeId).toBe(copy.id);
  expect(merged.state.conversations[copy.id]?.at(-1)?.content).toBe("Respuesta local");
});
it("merges edits to different materials and propagates deletion without resurrecting unchanged content", () => {
  const base = workspace(), second = createDocument("blank"); base.documents.push(second);
  const local = structuredClone(base), remote = structuredClone(base);
  local.documents[0]!.title = "Local"; remote.documents[1]!.title = "Remoto";
  expect(mergeWorkspaces(base, local, remote).state.documents.map(d => d.title)).toEqual(["Local", "Remoto"]);
  remote.documents.shift(); delete remote.conversations[base.activeId!]; remote.activeId = second.id;
  const merged = mergeWorkspaces(base, base, remote);
  expect(merged.state).toEqual(remote);
});
it("does not overwrite offline edits after restart when the acknowledged base is unavailable", () => {
  const local = workspace(), remote = structuredClone(local); local.documents[0]!.title = "Sin conexión";
  expect(mergeWorkspaces(null, local, remote).copies).toBe(1);
});
it("validates remote content and hashes the complete workspace deterministically", async () => {
  const state = workspace();
  expect(parseWorkspace(state)).toEqual(state);
  expect(await workspaceHash(state)).toBe(await workspaceHash(structuredClone(state)));
  expect(sameWorkspace(state, { ...state, activeId: null })).toBe(false);
  expect(() => parseWorkspace({ ...state, conversations: { x: [{ role: "system", content: "invalid" }] } })).toThrow();
});
