import { derivative, evaluate, expressionText, parseExpression, type Expr, type Variables } from "../scene/expression.ts";

export type FunctionGraphData = Variables & {
  source: string;
  angleUnit: "degrees" | "radians";
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  pointXs: number[];
  showDerivative: boolean;
};
export type GraphPoint = { x: number; y: number };
const trig = new Set(["sin", "cos", "tan"]);

export function validateFunctionGraph(value: unknown): value is FunctionGraphData {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  const finite = (key: string, limit: number) => typeof d[key] === "number" && Number.isFinite(d[key]) && Math.abs(d[key]) <= limit;
  if (typeof d.source !== "string" || typeof d.angleUnit !== "string" || !["degrees", "radians"].includes(d.angleUnit) ||
    !["xMin", "xMax", "yMin", "yMax"].every(key => finite(key, 10000)) ||
    !["a", "b", "c"].every(key => finite(key, 5)) || typeof d.showDerivative !== "boolean" ||
    (d.xMax as number) - (d.xMin as number) < 0.001 || (d.yMax as number) - (d.yMin as number) < 0.001 ||
    !Array.isArray(d.pointXs) || d.pointXs.length > 24 ||
    !d.pointXs.every((x: unknown) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 10000) ||
    new Set(d.pointXs).size !== d.pointXs.length) return false;
  try { parseExpression(d.source); return true; } catch { return false; }
}

/** Convert only trigonometric arguments; x and parameters retain their specified units. */
function angles(e: Expr, degrees: boolean): Expr {
  if (e.kind === "binary") return { ...e, left: angles(e.left, degrees), right: angles(e.right, degrees) };
  if (e.kind !== "call") return e;
  const argument = angles(e.argument, degrees);
  return { ...e, argument: degrees && trig.has(e.name) ? { kind: "binary", op: "*", left: argument, right: { kind: "number", value: Math.PI / 180 } } : argument };
}
function hasTrig(e: Expr): boolean {
  return e.kind === "call" ? trig.has(e.name) || hasTrig(e.argument) : e.kind === "binary" && (hasTrig(e.left) || hasTrig(e.right));
}
export function compileFunctionGraph(data: FunctionGraphData) {
  const original = parseExpression(data.source);
  const expression = angles(original, data.angleUnit === "degrees");
  const derived = derivative(expression, data);
  const valueAt = (x: number) => evaluate(expression, x, data);
  const slopeAt = (x: number) => Number.isFinite(valueAt(x)) ? evaluate(derived, x, data) : NaN;
  return { expression, derived, trigonometric: hasTrig(original), valueAt, slopeAt };
}
export function graphNumber(value: number): string {
  if (!Number.isFinite(value)) return "No definido";
  return Math.abs(value) <= 8 * Number.EPSILON ? "0" : String(Number(value.toPrecision(7)));
}
export function functionGraphFacts(data: FunctionGraphData) {
  const graph = compileFunctionGraph(data);
  return {
    source: data.source,
    angleUnit: data.angleUnit,
    trigonometric: graph.trigonometric,
    domainWindow: [data.xMin, data.xMax],
    derivative: expressionText(graph.derived),
    samples: data.pointXs.map(x => {
      const y = graph.valueAt(x), slope = graph.slopeAt(x);
      return { x, y: Number.isFinite(y) ? y : null, slope: Number.isFinite(slope) ? slope : null };
    }),
  };
}

/** Sample a curve without joining undefined values or jumps across vertical asymptotes. */
export function sampleFunctionGraph(data: FunctionGraphData, derived = false): GraphPoint[][] {
  const graph = compileFunctionGraph(data), value = derived ? graph.slopeAt : graph.valueAt;
  const ySpan = data.yMax - data.yMin, step = (data.xMax - data.xMin) / 720;
  const segments: GraphPoint[][] = [];
  let segment: GraphPoint[] = [];
  const end = () => { if (segment.length > 1) segments.push(segment); segment = []; };
  for (let i = 0; i <= 720; i++) {
    const x = data.xMin + i * step, y = value(x), previous = segment.at(-1);
    if (!Number.isFinite(y) || y < data.yMin - ySpan * 0.1 || y > data.yMax + ySpan * 0.1) { end(); continue; }
    if (previous) {
      const middle = value((previous.x + x) / 2);
      if (!Number.isFinite(middle) || Math.abs(y - previous.y) > ySpan / 2 || middle < data.yMin - ySpan * 0.1 || middle > data.yMax + ySpan * 0.1) end();
    }
    segment.push({ x, y });
  }
  end(); return segments;
}
export function functionGraphLesson(data: FunctionGraphData): [string, string][] {
  const facts = functionGraphFacts(data);
  return [
    ["Lee la función y sus ejes", `f(x) = ${data.source}. El eje horizontal representa x y el vertical, f(x).${facts.trigonometric ? ` Los ángulos se interpretan en ${data.angleUnit === "degrees" ? "grados (°)" : "radianes (rad)"}; las alturas del seno, coseno y tangente no son longitudes.` : ""}`],
    ["Relaciona los puntos con la curva", facts.samples.length ? `El motor calcula estos puntos: ${facts.samples.map(p => `(${graphNumber(p.x)}, ${p.y === null ? "no definido" : graphNumber(p.y)})`).join("; ")}. Cada pareja conserva el orden (x, f(x)).` : "Elige valores de x y evalúa la expresión para obtener las alturas de sus puntos."],
    ["Interpreta el trazado", `La ventana va de x = ${data.xMin} a ${data.xMax} y de y = ${data.yMin} a ${data.yMax}. La curva es una aproximación muestreada; no se unen puntos a través de valores no definidos ni de asíntotas.`],
    ["Explora el cambio", "Edita la expresión o sus parámetros y observa la curva y los puntos. Puedes mostrar la derivada para comparar las pendientes; si los ángulos están en grados, su cálculo incluye el factor π/180."],
  ];
}
