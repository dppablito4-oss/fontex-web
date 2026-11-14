import type { Primitive, PrimitiveScene } from "./schema.ts";
import { type Scope, scopeMatrix } from "./math.ts";
import { inverse, type Matrix } from "./linear-algebra.ts";
export function linkedMatrix(
  p: Primitive,
  scene: PrimitiveScene,
  scope: Scope,
): Matrix | undefined | null {
  if (
    !(p.kind === "geometric_shape" || p.kind === "vector_segment") ||
    !p.data.transformMatrixId
  ) return undefined;
  const chart = scene.primitives.find((n) => n.id === p.data.transformMatrixId);
  if (chart?.kind !== "data_chart" || !chart.data.matrixName) return undefined;
  const matrix = scopeMatrix(scope, chart.data.matrixName);
  return p.data.transformInverse ? inverse(matrix) : matrix;
}
