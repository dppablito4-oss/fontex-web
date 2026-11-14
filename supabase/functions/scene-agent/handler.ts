/** Tombstone for deployed v1 clients: closed before reading a body or contacting AI. */
export function sceneHandler() {
  return (_request: Request, userId?: string): Promise<Response> =>
    Promise.resolve(Response.json({
      code: userId ? "scene_agent_retired" : "auth_required",
      message: userId
        ? "Este agente se retiró. Abre el lienzo actual para usar Fontex AI."
        : "Inicia sesión para usar Fontex AI.",
    }, {
      status: userId ? 410 : 401,
      headers: { "Cache-Control": "no-store" },
    }));
}
