import { expect, it, vi } from "vitest";
import { newPrimitiveScene } from "../../core/primitives/schema";
import { requestPrimitiveAgent } from "./agent";
const mock = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../lib/supabase/client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return { supabase: createClient("https://stream-test.supabase.co", "test-public-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: mock.fetch } }) };
});

it("keeps cancellation attached after the SDK has returned streaming headers", async () => {
  let streamController!: ReadableStreamDefaultController<Uint8Array>;
  let fetchSignal: AbortSignal | undefined;
  mock.fetch.mockImplementation((_url: unknown, options: RequestInit) => {
    fetchSignal = options.signal ?? undefined;
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      streamController = controller;
      controller.enqueue(new TextEncoder().encode('data: {"type":"text","text":"Preparando"}\n\n'));
    } });
    fetchSignal?.addEventListener("abort", () => streamController.error(fetchSignal?.reason), { once: true });
    return Promise.resolve(new Response(stream, { headers: { "Content-Type": "text/event-stream" } }));
  });
  const abort = new AbortController(), onText = vi.fn();
  const request = requestPrimitiveAgent({ scene: newPrimitiveScene(), question: "Crea un ejemplo", task: "build", level: "primaria", selectedId: null }, onText, abort.signal);
  const observed = request.catch(() => undefined);
  try {
    await vi.waitFor(() => expect(onText).toHaveBeenCalledWith("Preparando"));
    abort.abort();
    expect(fetchSignal?.aborted).toBe(true);
  } finally {
    try { streamController.close(); } catch { /* Already aborted. */ }
    await observed;
  }
});
