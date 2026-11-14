export class BodyError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Enforce the application limit on bytes actually received, including chunked bodies. */
export async function boundedBytes(
  request: Request,
  maximum: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) {
    throw new BodyError("La petición supera el tamaño permitido.", 413);
  }
  if (!request.body) throw new BodyError("Falta el cuerpo de la petición.");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new BodyError("La petición supera el tamaño permitido.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function jsonObject(
  request: Request,
  maximum = 10000,
): Promise<Record<string, unknown>> {
  if (
    !request.headers.get("content-type")?.toLowerCase().startsWith(
      "application/json",
    )
  ) throw new BodyError("Se requiere JSON.");
  const bytes = await boundedBytes(request, maximum);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new BodyError("El cuerpo debe ser JSON válido.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BodyError("El cuerpo debe ser un objeto JSON.");
  }
  return value as Record<string, unknown>;
}

export async function boundedFormData(
  request: Request,
  maximum: number,
): Promise<FormData> {
  const bytes = await boundedBytes(request, maximum);
  try {
    return await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new BodyError("La carga debe usar multipart/form-data.");
  }
}
