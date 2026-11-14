type SequenceData = { start: number; difference: number; count: number };

export function sequenceTerms({
  start,
  difference,
  count,
}: SequenceData): number[] {
  return Array.from({ length: count }, (_, i) => start + difference * i);
}
