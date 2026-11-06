import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import { createPayload, generateTutorReply, type TutorRequest } from "./supabase/functions/_shared/practice/tutor";

export { createPayload, readReply } from "./supabase/functions/_shared/practice/tutor";

const endpoint = "/api/fontex-tutor";
const maxBodyBytes = 10_000;

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function readBody(request: IncomingMessage): Promise<TutorRequest> {
  const parts: Buffer[] = [];
  let bytes = 0;
  for await (const part of request as AsyncIterable<Buffer>) {
    bytes += part.byteLength;
    if (bytes > maxBodyBytes) throw new Error("Petición demasiado grande.");
    parts.push(part);
  }
  const body = JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown;
  if (!body || typeof body !== "object") throw new Error("Petición inválida.");
  return body;
}

export function practiceTutorPlugin(apiKey: string): Plugin {
  async function handle(request: IncomingMessage, response: ServerResponse) {
    const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress ?? "");
    const host = request.headers.host ?? "";
    const allowedHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
    if (!loopback || !allowedHost) return json(response, 403, { error: "El tutor con IA se habilita en localhost." });
    if (request.method === "GET") return json(response, 200, { available: true });
    if (request.method !== "POST" || request.headers.origin !== `http://${host}` || !request.headers["content-type"]?.startsWith("application/json")) {
      return json(response, 403, { error: "Solicitud no autorizada." });
    }

    let input: TutorRequest;
    try {
      input = await readBody(request);
    } catch {
      return json(response, 400, { error: "Petición inválida." });
    }
    const body = createPayload(input);
    if (!body) return json(response, 400, { error: "Falta una consulta o su fuente." });
    const result = await generateTutorReply(apiKey, body);
    return json(response, result.status, result.status === 200 ? result.reply : { error: result.message });
  }

  function configure(server: { middlewares: { use: (path: string, callback: (request: IncomingMessage, response: ServerResponse) => void) => void } }) {
    server.middlewares.use(endpoint, (request, response) => { void handle(request, response); });
  }

  return { name: "fontex-practice-tutor", configureServer: configure, configurePreviewServer: configure };
}
