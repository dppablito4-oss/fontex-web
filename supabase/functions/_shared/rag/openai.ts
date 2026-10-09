const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

export class EmbeddingProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(message);
  }
}

type EmbeddingResponse = {
  data?: Array<{ index?: number; embedding?: number[] }>;
  usage?: { prompt_tokens?: number; total_tokens?: number };
};

export async function createEmbeddings(options: {
  apiKey: string;
  model: string;
  dimensions: number;
  inputs: string[];
}) {
  if (!options.inputs.length) throw new Error("At least one embedding input is required.");
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        input: options.inputs,
        dimensions: options.dimensions,
        encoding_format: "float",
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    throw new EmbeddingProviderError(
      timeout ? "Embedding request timed out." : "Embedding provider is unavailable.",
      timeout ? "embedding_timeout" : "embedding_network_error",
      true,
      502,
    );
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new EmbeddingProviderError(
      retryable ? "Embedding provider is temporarily unavailable." : "Embedding provider rejected the request.",
      `embedding_provider_${response.status}`,
      retryable,
      response.status === 429 ? 429 : 502,
    );
  }

  let payload: EmbeddingResponse;
  try {
    payload = await response.json() as EmbeddingResponse;
  } catch {
    throw new EmbeddingProviderError("Embedding provider returned invalid JSON.", "embedding_invalid_response", true, 502);
  }

  const ordered = [...(payload.data ?? [])].sort((left, right) => (left.index ?? -1) - (right.index ?? -1));
  const embeddings = ordered.map((item) => item.embedding).filter((item): item is number[] => Array.isArray(item));
  if (
    embeddings.length !== options.inputs.length
    || embeddings.some((embedding) => embedding.length !== options.dimensions || embedding.some((value) => !Number.isFinite(value)))
  ) {
    throw new EmbeddingProviderError("Embedding provider returned an invalid vector batch.", "embedding_invalid_dimensions", true, 502);
  }

  const tokenCount = payload.usage?.total_tokens ?? payload.usage?.prompt_tokens;
  if (!Number.isInteger(tokenCount) || (tokenCount ?? 0) < 1) {
    throw new EmbeddingProviderError("Embedding usage metadata is missing.", "embedding_usage_missing", true, 502);
  }

  return {
    embeddings,
    tokenCount: tokenCount as number,
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
  };
}

export function vectorToPostgres(vector: number[]) {
  return `[${vector.join(",")}]`;
}
