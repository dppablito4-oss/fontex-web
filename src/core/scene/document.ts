import type { ConversationTurn } from "../agent/conversation.ts";
import { parseExpression, type Variables } from "./expression.ts";
import { CANVAS_WORKSPACE_ID } from "./formats.ts";
export const MAX_SCENE_TITLE = 160;
export const MAX_SCENE_FILE_BYTES = 1024 * 1024;
export type SceneElement = {
  id: string;
  kind: "plot" | "formula" | "table";
  expressionId: string;
} | { id: string; kind: "text"; text: string };
export type Scene = {
  version: 1;
  id: string;
  updatedAt: string;
  parameters: Variables;
  conversation: ConversationTurn[];
  title: string;
  expressions: { id: string; source: string }[];
  elements: SceneElement[];
};
export function parseScene(value: unknown): Scene {
  if (!value || typeof value !== "object") throw new Error("Escena inválida.");
  const v = value as Record<string, unknown>;
  if (
    v.version !== 1 || typeof v.title !== "string" || v.title.length > MAX_SCENE_TITLE ||
    !Array.isArray(v.expressions) ||
    v.expressions.length > 8 || !Array.isArray(v.elements) ||
    v.elements.length > 256
  ) throw new Error("Revisa el título y los elementos de la escena.");
  const id = v.id === undefined ? crypto.randomUUID() : v.id;
  const updatedAt = v.updatedAt === undefined ? new Date().toISOString() : v.updatedAt;
  if (typeof id !== "string" || !id || id === CANVAS_WORKSPACE_ID || id.startsWith("import-") || id.length > 140 || typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt))) throw new Error("Identidad de escena inválida.");
  const chat = v.conversation ?? [];
  if (!Array.isArray(chat) || chat.length > 80 || !chat.every((t: unknown) => t && typeof t === "object" && "role" in t && (t.role === "user" || t.role === "assistant") && "content" in t && typeof t.content === "string" && t.content.length <= 4000)) throw new Error("Conversación inválida.");
  const conversation: ConversationTurn[] = (chat as ConversationTurn[]).map(t => ({ role: t.role, content: t.content }));
  const raw = v.parameters ?? { a: 1, b: 0, c: -1 };
  if (
    !raw || typeof raw !== "object" ||
    !["a", "b", "c"].every((k) =>
      k in raw && typeof (raw as Record<string, unknown>)[k] === "number" &&
      Number.isFinite((raw as Record<string, unknown>)[k]) &&
      Math.abs((raw as Record<string, number>)[k]!) <= 5
    )
  ) throw new Error("Parámetros fuera de rango.");
  const parameters: Variables = {
    a: (raw as Variables).a,
    b: (raw as Variables).b,
    c: (raw as Variables).c,
  };
  const expressions = v.expressions.map((item: unknown) => {
    if (
      !item || typeof item !== "object" || !("id" in item) ||
      typeof item.id !== "string" || !item.id || item.id.length > 80 ||
      !("source" in item) || typeof item.source !== "string"
    ) throw new Error("Expresión inválida.");
    parseExpression(item.source);
    return { id: item.id, source: item.source };
  });
  if (new Set(expressions.map((e) => e.id)).size !== expressions.length) {
    throw new Error("Identificadores repetidos.");
  }
  const elements: SceneElement[] = v.elements.map((item: unknown) => {
    if (
      !item || typeof item !== "object" || !("id" in item) ||
      typeof item.id !== "string" || item.id.length > 80 || !("kind" in item)
    ) throw new Error("Elemento inválido.");
    if (
      item.kind === "text" && "text" in item && typeof item.text === "string" &&
      item.text.length <= 5000
    ) return { id: item.id, kind: "text", text: item.text };
    if (
      (item.kind === "plot" || item.kind === "formula" ||
        item.kind === "table") &&
      "expressionId" in item && typeof item.expressionId === "string" &&
      expressions.some((e) => e.id === item.expressionId)
    ) return { id: item.id, kind: item.kind, expressionId: item.expressionId };
    throw new Error("El elemento referencia una expresión inexistente.");
  });
  if (new Set(elements.map((e) => e.id)).size !== elements.length) {
    throw new Error("Elementos repetidos.");
  }
  const scene: Scene = { version: 1, id, updatedAt, title: v.title, parameters, conversation, expressions, elements };
  if (new TextEncoder().encode(JSON.stringify(scene, null, 2)).byteLength > MAX_SCENE_FILE_BYTES) {
    throw new Error("La escena supera el límite de 1 MiB. Reduce sus textos o elementos.");
  }
  return scene;
}
export function serializeScene(scene: Scene): string {
  return JSON.stringify(parseScene(scene), null, 2);
}
export function readSceneFile(text: string): Scene {
  if (new TextEncoder().encode(text).byteLength > MAX_SCENE_FILE_BYTES) throw new Error("El archivo supera el límite de 1 MiB.");
  return parseScene(JSON.parse(text) as unknown);
}
export function expressionScene(source: string): Scene {
  return parseScene({
    version: 1,
    title: "Exploración matemática",
    expressions: [{ id: "f", source }],
    elements: [{ id: "formula", kind: "formula", expressionId: "f" }, {
      id: "graph",
      kind: "plot",
      expressionId: "f",
    }, { id: "table", kind: "table", expressionId: "f" }],
  });
}
