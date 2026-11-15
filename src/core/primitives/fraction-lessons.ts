import { scalar, sceneScope } from "./math.ts";
import type { Primitive, PrimitiveScene } from "./schema.ts";

type Shape = Extract<Primitive, { kind: "geometric_shape" }>;
export const isFraction = (p: Primitive): p is Shape =>
  p.kind === "geometric_shape" && p.data.shape === "circle_fraction";
export type FractionTerm = { primitive: Shape; generated: boolean };
export type FractionLesson = {
  id: string; step: number; texts: Primitive[]; figures: Shape[];
  equation: { terms: FractionTerm[]; operator: "+" | "−" } | null;
};

/** Recognize only explicit numeric sums/subtractions whose result is already drawn. */
function equationFor(scene: PrimitiveScene, texts: Primitive[], figures: Shape[]): FractionLesson["equation"] {
  const scope = sceneScope(scene);
  const fraction = String.raw`\\(?:d?frac)\s*\{(\d+)\}\s*\{(\d+)\}`;
  for (const text of [...texts].reverse()) {
    if (text.kind !== "math_block") continue;
    const source = text.data.markdownContent.replace(/\\{2,}/g, "\\");
    const matches = [...source.matchAll(new RegExp(fraction + "\\s*([+−-])\\s*" + fraction + "\\s*=([^\\n$]*)", "g"))];
    for (const match of matches.reverse()) {
      const a = Number(match[1]), b = Number(match[2]), c = Number(match[4]), d = Number(match[5]);
      const results = [...match[6]!.matchAll(new RegExp(fraction, "g"))];
      const last = results.at(-1);
      if (!last || b < 1 || d < 1) continue;
      const n = Number(last[1]), den = Number(last[2]), sign = match[3] === "+" ? 1 : -1;
      if ((a*d + sign*c*b)*den !== n*b*d || den < 1) continue;
      const result = figures.find(p => p.data.divisions === den && scalar(p.data.shadedExpr, scope) === n);
      if (!result || [a,b,c,d].some(v => !Number.isSafeInteger(v)) ||
          b > 48 || d > 48 || a > b*3 || c > d*3) continue;
      const used = new Set([result.id]);
      const term = (num: number, denom: number, index: number): FractionTerm => {
        const existing = figures.find(p => !used.has(p.id) && p.data.divisions === denom && scalar(p.data.shadedExpr, scope) === num);
        if(existing) { used.add(existing.id); return { primitive: existing, generated: false }; }
        // These supplementary operands are a reading aid, never new saved objects.
        return { generated: true, primitive: { ...result, id: `${result.id}-reading-operand-${index}`, label: `${num}/${denom}`,
          data: { ...result.data, divisions: denom, shadedExpr: String(num) } } };
      };
      return { operator: sign === 1 ? "+" : "−", terms: [term(a,b,0), term(c,d,1), { primitive: result, generated: false }] };
    }
  }
  return null;
}

/** Existing presentation steps associate an explanation with its diagrams, even in old layouts. */
export function fractionLessons(scene: PrimitiveScene, primitives = scene.primitives): FractionLesson[] {
  const roots = primitives.filter(p => !("canvasId" in p.data && p.data.canvasId)), steps = [...new Set(roots.map(p => p.presentationStep))].sort((a,b) => a-b);
  return steps.flatMap(step => {
    const items = roots.filter(p => p.presentationStep === step);
    const figures = items.filter(isFraction).sort((a,b) => a.y-b.y || a.x-b.x);
    const texts = items.filter(p => p.kind === "math_block").sort((a,b) => a.y-b.y || a.x-b.x);
    if (!figures.length || !texts.length) return [];
    return [{ id: `fraction-lesson-${step}`, step, texts, figures, equation: equationFor(scene,texts,figures) }];
  });
}
