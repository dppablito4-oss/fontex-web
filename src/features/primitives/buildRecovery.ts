import { z } from "zod";
import { supabase } from "../../lib/supabase/client";
import { applyPrimitivePatch, parsePrimitiveScene, replySchema, type PrimitiveScene } from "../../core/primitives/schema";
import { organizePrimitiveScene } from "../../core/primitives/layout";
import { templateScene } from "../../core/primitives/templates";

export const buildSummarySchema = z.object({
  id: z.uuid(), state: z.enum(["pending", "ready", "succeeded", "refunded"]),
  created_at: z.string(), applied_at: z.string().nullable(),
});
const receiptSchema = buildSummarySchema.extend({ source: z.unknown(), question: z.string(), reply: replySchema.nullable() });
export type BuildSummary = z.infer<typeof buildSummarySchema>;
export type BuildReceipt = Omit<z.infer<typeof receiptSchema>, "source"> & { source: PrimitiveScene };
export async function listCanvasBuilds(sceneId: string): Promise<BuildSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_canvas_builds", { p_scene_id: sceneId });
  if (error) throw Error("No se pudieron consultar las construcciones pendientes.");
  return z.array(buildSummarySchema).parse(data);
}
export async function getCanvasBuild(id: string): Promise<BuildReceipt | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_canvas_build", { p_request_id: id });
  if (error) throw Error("No se pudo comprobar la construcción. Recupera la conexión antes de generar otra vez.");
  if (!data) return null;
  const parsed = receiptSchema.parse(data);
  return { ...parsed, source: parsePrimitiveScene(parsed.source) };
}
export async function acknowledgeCanvasBuild(id: string) {
  if (supabase) {
    const { error } = await supabase.rpc("ack_canvas_build", { p_request_id: id });
    if (error) throw Error("No se pudo confirmar la aplicación.");
  }
}
export const buildContent = (scene: PrimitiveScene) => JSON.stringify([scene.primitives, scene.variables]);
export function recoveredScene(current: PrimitiveScene, receipt: BuildReceipt, separate = false): PrimitiveScene {
  if (!receipt.reply || receipt.state !== "ready") throw Error("La construcción todavía no tiene un resultado recuperable.");
  if (!separate && current.appliedBuildIds?.includes(receipt.id)) return current;
  if (!separate && (current.id !== receipt.source.id || buildContent(current) !== buildContent(receipt.source))) {
    throw Error("El lienzo cambió. Recupera esta propuesta en otro lienzo para conservar tus ediciones.");
  }
  const source = separate ? receipt.source : current;
  let patched = applyPrimitivePatch(source, receipt.reply, templateScene);
  if (!source.primitives.length) patched = organizePrimitiveScene(patched);
  const turns = [...source.conversation];
  if (turns.at(-1)?.role !== "user" || turns.at(-1)?.content !== receipt.question) turns.push({ role: "user", content: receipt.question });
  turns.push({ role: "assistant", content: receipt.reply.message });
  return parsePrimitiveScene({ ...patched,
    ...(separate ? { id: crypto.randomUUID(), title: `${source.title.slice(0,140)} · recuperado` } : { id: current.id }),
    conversation: turns.slice(-80),
    appliedBuildIds: [...new Set([...(source.appliedBuildIds ?? []), receipt.id])].slice(-100),
  });
}

type Pending = { id: string; question: string; content: string };
const pendingKey = (owner: string, scene: string) => `fontex-pending-build:${owner}:${scene}`;
export function readPendingBuild(owner: string, scene: string): Pending | null {
  try { return z.object({ id: z.uuid(), question: z.string(), content: z.string() }).parse(JSON.parse(localStorage.getItem(pendingKey(owner,scene)) ?? "null")); }
  catch { return null; }
}
export function savePendingBuild(owner: string, scene: string, pending: Pending | null) {
  try {
    if (pending) localStorage.setItem(pendingKey(owner,scene),JSON.stringify(pending));
    else localStorage.removeItem(pendingKey(owner,scene));
  } catch { /* The server receipt also appears in the account's scene catalog. */ }
}
