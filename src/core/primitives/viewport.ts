import { scalar, type Scope } from "./math.ts";
import type { Primitive, PrimitiveScene } from "./schema.ts";
import { linkedMatrix } from "./transforms.ts";
import { transformPoint } from "./linear-algebra.ts";
import { sampleCurve } from "./curves.ts";

export type PlotBounds = [number, number, number, number];
type Plane = Extract<Primitive, { kind: "coordinate_canvas" }>;

export function shapeVertices(
  p: Extract<Primitive, { kind: "geometric_shape" }>,
  scope: Scope,
): [number, number][] {
  if (!p.data.regular) {
    return p.data.verticesExpr.map(([x, y]) => [scalar(x, scope), scalar(y, scope)]);
  }
  const n = p.data.shape === "triangle" ? 3 : scalar(p.data.sidesExpr ?? String(p.data.sides), scope);
  if (!Number.isInteger(n) || n < 3 || n > 24) throw Error("El polígono requiere entre 3 y 24 lados enteros.");
  const angle = p.data.rotationExpr ? scalar(p.data.rotationExpr, scope) * Math.PI / 180 : -Math.PI / 2;
  const radius = scalar(p.data.sideExpr, scope) / (2 * Math.sin(Math.PI / n));
  return Array.from({ length: n }, (_, i) => [
    radius * Math.cos(2 * Math.PI * i / n + angle),
    radius * Math.sin(2 * Math.PI * i / n + angle),
  ]);
}

export function authoredBounds(p: Plane, scope: Scope): PlotBounds {
  return [...p.data.domainX, ...p.data.rangeY].map((v) => scalar(v, scope)) as PlotBounds;
}

/** Fit finite geometric content; unbounded Cartesian functions retain their authored window. */
export function fitPlotBounds(p: Plane, scene: PrimitiveScene, scope: Scope): PlotBounds {
  const fallback = authoredBounds(p, scope);
  if (p.data.mode === "unit_circle") return fallback;
  const points: [number, number][] = [];
  for (const child of scene.primitives) {
    if (!("canvasId" in child.data) || child.data.canvasId !== p.id) continue;
    if (child.kind === "geometric_shape" || child.kind === "vector_segment") {
      const matrix = linkedMatrix(child, scene, scope);
      if (matrix === null) continue;
      const vertices = child.kind === "geometric_shape"
        ? shapeVertices(child, scope)
        : [child.data.start, child.data.end].map((pair) => pair.map((v) => scalar(v, scope)) as [number, number]);
      points.push(...vertices.map((point) => matrix ? transformPoint(matrix, point) : point));
    } else if (child.kind === "function_region" && child.data.curveMode && child.data.curveMode !== "cartesian") {
      for (const segment of sampleCurve(child, scope, [-10000, 10000, -10000, 10000], 320)) {
        points.push(...segment.map(({ x, y }): [number, number] => [x, y]));
      }
    }
  }
  const finite = points.filter((point) => point.every(Number.isFinite));
  if (!finite.length) return fallback;
  const xs = finite.map(([x]) => x), ys = finite.map(([, y]) => y);
  const pad = (values: number[]): [number, number] => {
    const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
    const margin = Math.max((hi - lo) * .14, .25);
    return [Math.max(-10000, lo - margin), Math.min(10000, hi + margin)];
  };
  const [x0, x1] = pad(xs), [y0, y1] = pad(ys);
  return x1 - x0 >= .001 && y1 - y0 >= .001 ? [x0, x1, y0, y1] : fallback;
}

/** Expand one axis so a unit has the same physical size in both directions. */
export function equalPlotBounds(bounds: PlotBounds, aspect: number): PlotBounds {
  const [x0, x1, y0, y1] = bounds;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const width = Math.max(x1 - x0, (y1 - y0) * aspect);
  const height = width / aspect;
  return [cx - width / 2, cx + width / 2, cy - height / 2, cy + height / 2];
}

export function zoomPlotBounds(bounds: PlotBounds, factor: number, anchor = [.5, .5]): PlotBounds {
  const next = [...bounds] as PlotBounds;
  for (const axis of [0, 1]) {
    const i = axis * 2, size = bounds[i + 1]! - bounds[i]!;
    const span = Math.max(.002, Math.min(20000, size * factor));
    const center = bounds[i]! + size * anchor[axis]!;
    const lo = Math.max(-10000, Math.min(10000 - span, center - span * anchor[axis]!));
    next[i] = lo;
    next[i + 1] = lo + span;
  }
  return next;
}

export function panPlotBounds(bounds: PlotBounds, dx: number, dy: number): PlotBounds {
  const shift = (lo: number, hi: number, delta: number): [number, number] => {
    const offset = Math.max(-10000 - lo, Math.min(10000 - hi, delta));
    return [lo + offset, hi + offset];
  };
  return [...shift(bounds[0], bounds[1], dx), ...shift(bounds[2], bounds[3], dy)];
}
