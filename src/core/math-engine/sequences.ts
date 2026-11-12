import type { SequenceData } from "../document-schema/document.ts";

export function sequenceTerms({
  start,
  difference,
  count,
}: SequenceData): number[] {
  return Array.from({ length: count }, (_, i) => start + difference * i);
}
