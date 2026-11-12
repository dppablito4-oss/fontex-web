import { polygonPerimeter, primeFactorisation, signedPolygonArea, type Vertex } from "../vendor/mathigon.ts";
export type PolygonData = { vertices: Vertex[] };
export type FactorizationData = { number: number };
const cross = (a: Vertex, b: Vertex, c: Vertex) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const onSegment = (a: Vertex, b: Vertex, c: Vertex) => cross(a, b, c) === 0 && c.x >= Math.min(a.x, b.x) && c.x <= Math.max(a.x, b.x) && c.y >= Math.min(a.y, b.y) && c.y <= Math.max(a.y, b.y);
function intersects(a: Vertex, b: Vertex, c: Vertex, d: Vertex) {
  const x = cross(a, b, c), y = cross(a, b, d), z = cross(c, d, a), w = cross(c, d, b);
  return x * y < 0 && z * w < 0 || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
export function analyzePolygon(vertices: Vertex[]) {
  if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > 8 || vertices.some(p => !p || !Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x > 20 || p.y > 20) || new Set(vertices.map(p => `${p.x},${p.y}`)).size !== vertices.length) throw new Error("Usa de 3 a 8 vértices distintos, con coordenadas enteras de 0 a 20.");
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    // Reject adjacent edges that fold back onto each other.
    const a = vertices[i]!, b = vertices[(i + 1) % n]!, c = vertices[(i + 2) % n]!;
    if (cross(a, b, c) === 0 && (onSegment(a, b, c) || onSegment(b, c, a))) throw new Error("Los lados no pueden superponerse.");
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || i === 0 && j === n - 1) continue;
      if (intersects(a, b, vertices[j]!, vertices[(j + 1) % n]!)) throw new Error("Los lados del polígono no pueden cruzarse ni tocarse fuera de sus vértices vecinos.");
    }
  }
  const area = Math.abs(signedPolygonArea(vertices));
  if (!area) throw new Error("El polígono debe tener un área mayor que cero.");
  return { area, areaFraction: { n: area * 2, d: 2 }, perimeter: polygonPerimeter(vertices), sides: n };
}
export function analyzeFactors(number: number) {
  if (!Number.isInteger(number) || number < 2 || number > 360) throw new Error("El número debe ser entero, de 2 a 360.");
  const factors = primeFactorisation(number);
  let quotient = number;
  const divisions = factors.map(factor => { const dividend = quotient; quotient /= factor; return { dividend, factor, quotient }; });
  return { factors, divisions, expression: factors.join(" × "), prime: factors.length === 1 };
}
export function factorAnswer(attempt: string, expected: number[]): boolean | null {
  const normalized = attempt.trim().replace(/²/g, "^2").replace(/³/g, "^3");
  const parts = normalized.split(/\s*[×xX*·]\s*/);
  if (parts.length > 12 || !parts.length) return null;
  const factors: number[] = [];
  for (const part of parts) {
    const match = part.match(/^(\d{1,3})(?:\s*\^\s*([1-8]))?$/);
    if (!match) return null;
    factors.push(...Array<number>(Number(match[2] ?? 1)).fill(Number(match[1])));
  }
  return factors.length === expected.length && factors.sort((a, b) => a - b).every((v, i) => v === expected[i]);
}
