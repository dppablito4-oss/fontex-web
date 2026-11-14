import { compile, scalar, type Scope } from "./math.ts";
import type { Primitive } from "./schema.ts";
type Curve = Extract<Primitive, { kind: "function_region" }>;
export function curvePoint(
  p: Curve,
  parameter: number,
  scope: Scope,
): { x: number; y: number } {
  const mode = p.data.curveMode ?? "cartesian";
  if (mode === "cartesian") {
    return {
      x: parameter,
      y: compile(p.data.expression, scope, p.data.angleUnit).value(parameter),
    };
  }
  const expression = (source: string, token: "t" | "theta") =>
    compile(
      source.replace(token === "t" ? /\bt\b/g : /\btheta\b/g, "x"),
      scope,
      p.data.angleUnit,
    ).value(parameter);
  if (mode === "parametric") {
    return {
      x: expression(p.data.xExpr ?? "t", "t"),
      y: expression(p.data.yExpr ?? "0", "t"),
    };
  }
  const r = expression(p.data.rExpr ?? "1", "theta"),
    angle = p.data.angleUnit === "deg" ? parameter * Math.PI / 180 : parameter;
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}
/** Bounded sampling in parameter space. SVG clips the retained continuous segments. */
export function sampleCurve(
  p: Curve,
  scope: Scope,
  bounds: [number, number, number, number],
  count = 640,
) {
  const lo = scalar(p.data.parameterFromExpr ?? "0", scope),
    hi = scalar(p.data.parameterToExpr ?? "2*pi", scope);
  const [xmin, xmax, ymin, ymax] = bounds,
    spanX = xmax - xmin,
    spanY = ymax - ymin;
  const segments: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  const end = () => {
    if (segment.length > 1) segments.push(segment);
    segment = [];
  };
  // Compile once, not once per sample.
  const mode = p.data.curveMode ?? "cartesian";
  const make = (source: string, token: string) =>
    compile(
      source.replace(new RegExp(`\\b${token}\\b`, "g"), "x"),
      scope,
      p.data.angleUnit,
    ).value;
  const fx = mode === "parametric" ? make(p.data.xExpr ?? "t", "t") : null;
  const fy = mode === "parametric" ? make(p.data.yExpr ?? "0", "t") : null;
  const radius = mode === "polar" ? make(p.data.rExpr ?? "1", "theta") : null;
  const point = (t: number) => {
    if (fx && fy) return { x: fx(t), y: fy(t) };
    const r = radius?.(t) ?? 0,
      a = p.data.angleUnit === "deg" ? t * Math.PI / 180 : t;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  };
  const finite = (q: { x: number; y: number }) =>
    Number.isFinite(q.x) && Number.isFinite(q.y) &&
    Math.max(Math.abs(q.x), Math.abs(q.y)) < 1e10;
  const n = Math.max(32, Math.min(1280, Math.floor(count)));
  for (let i = 0; i <= n; i++) {
    const t = lo + (hi - lo) * i / n, q = point(t), previous = segment.at(-1);
    if (
      !finite(q) || q.x < xmin - spanX || q.x > xmax + spanX ||
      q.y < ymin - spanY || q.y > ymax + spanY
    ) {
      end();
      continue;
    }
    if (previous) {
      const mid = point(t - (hi - lo) / n / 2);
      if (
        !finite(mid) || Math.abs(q.x - previous.x) > spanX / 2 ||
        Math.abs(q.y - previous.y) > spanY / 2
      ) end();
    }
    segment.push(q);
  }
  end();
  return segments;
}
