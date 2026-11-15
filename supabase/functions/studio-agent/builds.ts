import { z } from "zod";
import type {
  PrimitiveReply,
  PrimitiveScene,
} from "../../../src/core/primitives/schema.ts";

type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
const reserved = z.object({
  allowed: z.boolean(),
  balance: z.number().int().min(0),
  reason: z.string(),
});
const settled = z.object({
  balance: z.number().int().min(0),
  status: z.enum(["succeeded", "refunded"]),
});
export type BuildAccess = {
  begin: (
    user: string,
    id: string,
    scene: PrimitiveScene,
    question: string,
  ) => Promise<z.infer<typeof reserved>>;
  complete: (
    id: string,
    reply: PrimitiveReply,
  ) => Promise<z.infer<typeof settled>>;
  fail: (
    id: string,
    code: "generation_failed" | "cancelled" | "settlement_pending",
  ) => Promise<void>;
};
export function buildAccess(rpc: Rpc): BuildAccess {
  return {
    async begin(user, id, scene, question) {
      const result = await rpc("begin_canvas_build", {
        p_user_id: user,
        p_request_id: id,
        p_scene: scene,
        p_question: question,
      });
      if (result.error) {
        throw Error("No se pudo guardar el inicio de la construcción.");
      }
      return reserved.parse(result.data);
    },
    async complete(id, reply) {
      const result = await rpc("complete_canvas_build", {
        p_request_id: id,
        p_reply: reply,
      });
      if (result.error) {
        throw Error(
          "No se pudo conservar la propuesta. Consulta las construcciones pendientes antes de reintentar.",
        );
      }
      return settled.parse(result.data);
    },
    async fail(id, code) {
      const result = await rpc("fail_canvas_build", {
        p_request_id: id,
        p_code: code,
      });
      if (result.error) {
        throw Error("No se pudo registrar el estado de la construcción.");
      }
    },
  };
}
