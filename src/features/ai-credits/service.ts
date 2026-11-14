import { z } from "zod";
import { supabase } from "../../lib/supabase/client";
export const creditStatusSchema = z.object({
  balance: z.number().int().min(0).max(1000000),
  initial_credits: z.literal(5),
  is_admin: z.boolean(),
  active_generation: z.boolean(),
});
export type CreditStatus = z.infer<typeof creditStatusSchema>;
const account = z.object({
  user_id: z.uuid(),
  email: z.string().nullable(),
  display_name: z.string(),
  credits: z.number().int().min(0),
  created_at: z.string(),
  is_admin: z.boolean(),
});
export type CreditAccount = z.infer<typeof account>;
export const historySchema = z.array(z.object({
  id: z.uuid(),
  kind: z.enum(["initial", "grant", "reserve", "complete", "refund"]),
  delta: z.number().int(),
  balance_after: z.number().int(),
  reason: z.string(),
  created_at: z.string(),
}));
export type CreditEvent = z.infer<typeof historySchema>[number];
export async function getCreditStatus(): Promise<CreditStatus> {
  if (!supabase) throw Error("Inicia sesión para consultar tu saldo.");
  const { data, error } = await supabase.rpc("get_ai_credit_status");
  if (error) throw Error("No se pudo consultar el saldo de generaciones.");
  return creditStatusSchema.parse(data);
}
export async function listCreditAccounts(search: string, offset: number) {
  if (!supabase) throw Error("Inicia sesión para administrar créditos.");
  const { data, error } = await supabase.rpc("admin_list_ai_accounts", {
    p_search: search,
    p_limit: 25,
    p_offset: offset,
  });
  if (error) {
    throw Error(
      error.code === "42501"
        ? "Tu cuenta no tiene permiso para administrar créditos."
        : "No se pudieron cargar las cuentas.",
    );
  }
  const result = z.object({
    accounts: z.array(account),
    page_size: z.number().int(),
  }).parse(data);
  return {
    accounts: result.accounts.slice(0, 25),
    hasMore: result.accounts.length > 25,
  };
}
export async function grantCredits(
  userId: string,
  amount: number,
  reason: string,
  requestId: string,
) {
  if (!supabase) throw Error("Inicia sesión para administrar créditos.");
  const { data, error } = await supabase.rpc("admin_grant_ai_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_request_id: requestId,
  });
  if (error) {
    throw Error(
      error.code === "42501"
        ? "Tu cuenta no tiene permiso para asignar créditos."
        : "No se pudo confirmar la asignación. Puedes reintentar sin duplicarla.",
    );
  }
  return z.object({ balance: z.number().int(), duplicate: z.boolean() }).parse(
    data,
  );
}
export async function creditHistory(userId: string) {
  if (!supabase) throw Error("Inicia sesión para consultar el historial.");
  const { data, error } = await supabase.rpc("admin_ai_credit_history", {
    p_user_id: userId,
  });
  if (error) throw Error("No se pudo cargar el historial de créditos.");
  return historySchema.parse(data);
}
export function creditsChanged() {
  window.dispatchEvent(new Event("fontex-ai-credits-changed"));
}
