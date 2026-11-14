import { z } from "zod";
export type CreditAccess = {
  reserve: (
    userId: string,
    requestId: string,
  ) => Promise<{ allowed: boolean; balance: number; reason: string }>;
  finish: (
    requestId: string,
    success: boolean,
  ) => Promise<{ balance: number; status: "succeeded" | "refunded" }>;
};
const reservation = z.object({
  allowed: z.boolean(),
  balance: z.number().int().min(0),
  reason: z.string(),
});
const settlement = z.object({
  balance: z.number().int().min(0),
  status: z.enum(["succeeded", "refunded"]),
});
type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
export function creditAccess(rpc: Rpc): CreditAccess {
  return {
    async reserve(userId, requestId) {
      const { data, error } = await rpc("reserve_ai_generation", {
        p_user_id: userId,
        p_request_id: requestId,
      });
      if (error) {
        throw Error("No se pudo reservar el crédito. Intenta de nuevo.");
      }
      return reservation.parse(data);
    },
    async finish(requestId, success) {
      const { data, error } = await rpc("finish_ai_generation", {
        p_request_id: requestId,
        p_success: success,
      });
      if (error) throw Error("No se pudo confirmar el saldo de la generación.");
      return settlement.parse(data);
    },
  };
}
