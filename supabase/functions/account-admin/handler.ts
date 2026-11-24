import { z } from "zod";
import { BodyError, jsonObject } from "../_shared/http.ts";
type Result = {
  data?: unknown;
  error?:
    | { code?: string; message?: string; statusCode?: string | number }
    | null;
};
export type AccountAdminDependencies = {
  prepare(args: Record<string, unknown>): PromiseLike<Result>;
  remove(paths: string[]): PromiseLike<Result>;
  finish(userId: string, requestId: string): PromiseLike<Result>;
};
const bodySchema = z.object({
  userId: z.uuid(),
  requestId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  confirmation: z.string().trim().min(1).max(254),
}).strict();
const planSchema = z.object({
  deleted: z.boolean(),
  request_id: z.uuid(),
  paths: z.array(z.string()).max(10000),
});
function failure(error: Result["error"]) {
  const codes = [
    "admin_mfa_required",
    "protected_admin_account",
    "account_confirmation_required",
    "account_owns_shared_resources",
    "account_generation_pending",
    "account_not_found",
    "account_request_mismatch",
  ];
  const code = codes.find((c) => error?.message?.includes(c)) ??
    (error?.code === "42501" ? "admin_required" : "account_operation_failed");
  return Response.json({
    code,
    message: "No se pudo completar la operación de cuenta.",
  }, { status: error?.code === "42501" ? 403 : 400 });
}
export function createAccountAdminHandler(deps: AccountAdminDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ code: "method_not_allowed" }, { status: 405 });
    }
    try {
      const body = bodySchema.parse(await jsonObject(request));
      const prepared = await deps.prepare({
        p_user_id: body.userId,
        p_confirm: body.confirmation,
        p_reason: body.reason,
        p_request_id: body.requestId,
      });
      if (prepared.error) return failure(prepared.error);
      const plan = planSchema.parse(prepared.data);
      if (plan.deleted) return Response.json({ deleted: true });
      // The manifest comes from the database, never from a client-supplied path.
      if (
        plan.paths.some((path) =>
          !path.startsWith(`${body.userId}/`) ||
          !/^[a-f\d-]{36}\/[a-f\d-]{36}\.pdf$/i.test(path)
        )
      ) {
        return Response.json({ code: "invalid_deletion_manifest" }, {
          status: 500,
        });
      }
      for (let i = 0; i < plan.paths.length; i += 100) {
        const result = await deps.remove(plan.paths.slice(i, i + 100));
        if (result.error && String(result.error.statusCode) !== "404") {
          return Response.json({
            code: "account_storage_failed",
            message:
              "No se pudieron retirar todos los PDF. Puedes reintentar la eliminación.",
          }, { status: 502 });
        }
      }
      const finished = await deps.finish(body.userId, plan.request_id);
      if (finished.error) return failure(finished.error);
      if (
        !finished.data || typeof finished.data !== "object" ||
        !("deleted" in finished.data) || finished.data.deleted !== true
      ) {
        return Response.json({ code: "account_operation_failed" }, {
          status: 500,
        });
      }
      return Response.json({ deleted: true });
    } catch (error) {
      return Response.json({
        code: "invalid_account_request",
        message: "La petición de cuenta no es válida.",
      }, { status: error instanceof BodyError ? error.status : 400 });
    }
  };
}
