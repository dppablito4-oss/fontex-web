export const primitiveAgentContract = "primitive-agent-v4";

/** Advertise the deployed validator through the existing CORS preflight. */
export function withPrimitiveContract(
  handler: (request: Request) => Response | Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    const response = await handler(request);
    if (request.method !== "OPTIONS") return response;
    const headers = new Headers(response.headers);
    headers.set("X-Fontex-Agent-Contract", primitiveAgentContract);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
