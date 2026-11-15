import { interpolate, scalar, sceneFunctions, sceneScope, type Scope } from "./math.ts";
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
function equationFor(scope: Scope, source: string, figures: Shape[]): FractionLesson["equation"] {
  const fraction = String.raw`\\(?:d?frac)\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}`;
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
  return null;
}

/** Pair each explanation with its own drawings, leaving later conclusions after them. */
export function fractionLessons(scene: PrimitiveScene, primitives = scene.primitives): FractionLesson[] {
  const roots = primitives.filter(p => !("canvasId" in p.data && p.data.canvasId)), steps = [...new Set(roots.map(p => p.presentationStep))].sort((a,b) => a-b);
  if (!roots.some(isFraction)) return [];
  const scope = sceneScope(scene), functions = sceneFunctions(scene);
  return steps.flatMap(step => {
    const items = roots.filter(p => p.presentationStep === step);
    const figures = items.filter(isFraction);
    const texts = items.filter(p => p.kind === "math_block");
    if (!figures.length || !texts.length) return [];
    const groups = new Map<string, FractionLesson>(), available = new Set(figures.map(p => p.id));
    const groupFor = (text: Primitive) => {
      let group = groups.get(text.id);
      if (!group) {
        group = { id: `fraction-lesson:${step}:${text.id}`, step, texts: [text], figures: [], equation: null };
        groups.set(text.id, group);
      }
      return group;
    };
    for (const text of texts) {
      const source = interpolate(text.data.markdownContent, scope, functions).replace(/\\{2,}/g, "\\");
      const remaining = figures.filter(p => available.has(p.id));
      const equation = equationFor(scope, source, remaining);
      const references = [...source.matchAll(/\\(?:d?frac)\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}|\b(\d+)\s*\/\s*(\d+)\b/g)]
        .map(m => [Number(m[1] ?? m[3]), Number(m[2] ?? m[4])]);
      const matched = remaining.filter(p => references.some(([n,d]) => p.data.divisions === d && scalar(p.data.shadedExpr, scope) === n));
      if (!matched.length && !equation) continue;
      const group = groupFor(text);
      group.equation = equation;
      group.figures = matched;
      for (const p of matched) available.delete(p.id);
    }
    // Old scenes may describe variable-based drawings without a numeric formula.
    // Keep their source sequence; a legacy texts-first block starts with its definition.
    const textsFirst = texts.every(text => items.indexOf(text) < items.indexOf(figures[0]!));
    for (const figure of figures.filter(p => available.has(p.id))) {
      const preceding = texts.filter(text => items.indexOf(text) < items.indexOf(figure));
      const text = textsFirst ? texts[0]! : preceding.at(-1) ?? texts[0]!;
      groupFor(text).figures.push(figure);
    }
    return texts.flatMap(text => groups.has(text.id) ? [groups.get(text.id)!] : []);
  });
}
