export type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
export async function betaDenial(
  userId: string | undefined,
  rpc: Rpc,
  usesAi = false,
): Promise<Response | null> {
  const deny = (message: string, code: string, status: number) =>
    Response.json({ message, code }, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (!userId) {
    return deny("Se requiere una sesión válida.", "auth_required", 401);
  }
  try {
    const { data, error } = await rpc("internal_beta_access", {
      p_user_id: userId,
    });
    if (
      error || !data || typeof data !== "object" || !("allowed" in data) ||
      typeof data.allowed !== "boolean" || !("ai_enabled" in data) ||
      typeof data.ai_enabled !== "boolean"
    ) throw Error("invalid access response");
    if (!data.allowed) {
      return deny(
        "Esta cuenta necesita una invitación a la beta cerrada.",
        "beta_invitation_required",
        403,
      );
    }
    if (usesAi && !data.ai_enabled) {
      return deny(
        "La IA está pausada temporalmente. Puedes seguir usando las herramientas locales.",
        "ai_paused",
        503,
      );
    }
    return null;
  } catch {
    return deny(
      "No se pudo verificar el acceso a la beta. Intenta más tarde.",
      "beta_access_unavailable",
      503,
    );
  }
}
export type RequestAccess = {
  reserve(
    userId: string,
    requestId: string,
    task: "chat" | "build",
    tokens: number,
  ): Promise<{ allowed: boolean; reason: string }>;
  finish(requestId: string): Promise<void>;
};
export function requestAccess(rpc: Rpc): RequestAccess {
  return {
    async reserve(userId, requestId, task, tokens) {
      const { data, error } = await rpc("reserve_canvas_ai_request", {
        p_user_id: userId,
        p_request_id: requestId,
        p_task: task,
        p_reserved_tokens: tokens,
      });
      if (
        error || !data || typeof data !== "object" || !("allowed" in data) ||
        typeof data.allowed !== "boolean" || !("reason" in data) ||
        typeof data.reason !== "string"
      ) throw Error("No se pudo comprobar el límite de IA.");
      return { allowed: data.allowed, reason: data.reason };
    },
    async finish(requestId) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = await rpc("finish_canvas_ai_request", {
          p_request_id: requestId,
        });
        if (!error) return;
      }
      throw Error("No se pudo liberar la reserva de IA.");
    },
  };
}
