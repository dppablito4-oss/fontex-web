export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

export type TextChunk = {
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  content: string;
  estimatedTokens: number;
};

export function normalizeExtractedText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function tailAtWordBoundary(value: string, maximumCharacters: number) {
  if (maximumCharacters <= 0) return "";
  if (value.length <= maximumCharacters) return value;
  const candidate = value.slice(-maximumCharacters);
  const firstSpace = candidate.search(/\s/);
  return (firstSpace >= 0 ? candidate.slice(firstSpace + 1) : candidate).trim();
}

function splitLongUnit(value: string, maximumCharacters: number) {
  const pieces: string[] = [];
  let remaining = value.trim();
  while (remaining.length > maximumCharacters) {
    const candidate = remaining.slice(0, maximumCharacters + 1);
    const boundary = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("; "), candidate.lastIndexOf(" "));
    const splitAt = boundary >= Math.floor(maximumCharacters * 0.55) ? boundary + 1 : maximumCharacters;
    pieces.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

function pageChunks(text: string, targetCharacters: number, overlapCharacters: number) {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return [];

  const units = normalized
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u)
    .flatMap((unit) => splitLongUnit(unit, targetCharacters))
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const unit of units) {
    const next = current ? `${current}\n\n${unit}` : unit;
    if (current && next.length > targetCharacters) {
      chunks.push(current.trim());
      const overlap = tailAtWordBoundary(current, overlapCharacters);
      current = overlap ? `${overlap}\n\n${unit}` : unit;
      if (current.length > targetCharacters + overlapCharacters) {
        const forced = splitLongUnit(current, targetCharacters);
        chunks.push(...forced.slice(0, -1));
        current = forced.at(-1) ?? "";
      }
    } else {
      current = next;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function createPageAwareChunks(
  pages: ExtractedPage[],
  targetTokens: number,
  overlapTokens: number,
) {
  const targetCharacters = targetTokens * 4;
  const overlapCharacters = overlapTokens * 4;
  const chunks: TextChunk[] = [];

  for (const page of pages) {
    for (const content of pageChunks(page.text, targetCharacters, overlapCharacters)) {
      chunks.push({
        chunkIndex: chunks.length,
        pageStart: page.pageNumber,
        pageEnd: page.pageNumber,
        content,
        estimatedTokens: estimateTokens(content),
      });
    }
  }

  return chunks;
}
