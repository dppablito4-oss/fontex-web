// Keep enough margin for validation and receipt settlement within the hosted
// Edge worker's 150-second free-plan lifetime. Credits expire after 180 seconds.
export const generationLimits = {
  build: { outputTokens: 32000, serverMs: 125000, clientMs: 140000 },
  chat: { outputTokens: 2048, serverMs: 75000, clientMs: 85000 },
} as const;

// JSON schema and instructions are input tokens too. UTF-8 bytes are not tokens;
// use a conservative estimate instead of reserving a token for every byte.
export const generationTokenBudget = (
  inputBytes: number,
  outputTokens: number,
) => Math.ceil(inputBytes / 2) + outputTokens;
