import type { PrimitiveScene } from "./schema.ts";
export function presentationSteps(scene: PrimitiveScene): number[] {
  const values = scene.primitives.map((p) => {
    const parentId = "canvasId" in p.data ? p.data.canvasId : null;
    const parent = parentId
      ? scene.primitives.find((n) => n.id === parentId)
      : undefined;
    return Math.max(p.presentationStep, parent?.presentationStep ?? 1);
  });
  return [...new Set(values.length ? values : [1])].sort((a, b) => a - b);
}
export function advanceStep(
  current: number,
  delta: number,
  steps: number[],
): number {
  return steps[
    Math.max(
      0,
      Math.min(steps.length - 1, Math.max(0, steps.indexOf(current)) + delta),
    )
  ]!;
}
