/** Decode SSE across arbitrary byte boundaries, including UTF-8 and CRLF. */
export async function* eventData(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      if (buffer.length > 1_000_000) {
        throw new Error("Respuesta demasiado grande.");
      }
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const data = block.split(/\r?\n/).filter((line) =>
          line.startsWith("data:")
        ).map((line) => line.slice(5).trimStart()).join("\n");
        if (data && data !== "[DONE]") yield JSON.parse(data) as unknown;
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Only reveal the message string; never display JSON actions or partial escapes. */
export function partialMessage(json: string): string {
  const start = /"message"\s*:\s*"/.exec(json);
  if (!start) return "";
  const from = start.index + start[0].length;
  let end = from;
  while (end < json.length) {
    if (json[end] === '"') break;
    if (json[end] === "\\") {
      const size = json[end + 1] === "u" ? 6 : 2;
      if (end + size > json.length) break;
      end += size;
    } else end++;
  }
  try {
    return (JSON.parse('"' + json.slice(from, end) + '"') as string).slice(
      0,
      4000,
    );
  } catch {
    return "";
  }
}
