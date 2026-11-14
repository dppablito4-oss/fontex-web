// Default diagram colors follow the interface theme without rewriting saved
// scenes. Authored colors outside this default palette remain unchanged.
const defaultColors: Record<string, string> = {
  "#38a989": "var(--ui-math-primary)",
  "#a7e9d3": "var(--ui-math-fill)",
};

export function diagramColor(color: string): string {
  return defaultColors[color.toLowerCase()] ?? color;
}
