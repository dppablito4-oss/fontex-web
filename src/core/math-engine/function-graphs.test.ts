import { expect, it } from "vitest";
import { createObject } from "../object-registry/registry";
import { parseDocument } from "../document-schema/document";
import { compileFunctionGraph, functionGraphFacts, sampleFunctionGraph, validateFunctionGraph, type FunctionGraphData } from "./function-graphs";

const sine = (): FunctionGraphData => ({ source: "sin(x)", angleUnit: "degrees", xMin: 0, xMax: 360, yMin: -1.5, yMax: 1.5, a: 1, b: 0, c: 0, pointXs: [0, 90, 180, 270, 360], showDerivative: false });

it("computes the agreed sine points in degrees from the expression rather than model-provided heights", () => {
  const facts = functionGraphFacts(sine());
  facts.samples.forEach((point, i) => expect(point.y).toBeCloseTo([0, 1, 0, -1, 0][i]!, 12));
  expect(facts.angleUnit).toBe("degrees");
  expect(compileFunctionGraph({ ...sine(), angleUnit: "radians" }).valueAt(Math.PI / 2)).toBeCloseTo(1, 12);
  expect(compileFunctionGraph({ ...sine(), source: "cos(x)" }).valueAt(180)).toBeCloseTo(-1, 12);
});

it.each(["sin(x)", "cos(2*x)", "tan(x)", "sin(x)+x/10", "a*sin(b*x+c)"])("differentiates %s with the degree conversion inside the chain rule", source => {
  const data = { ...sine(), source, a: 2, b: 2, c: 1 };
  const graph = compileFunctionGraph(data), x = 20, h = 1e-4;
  expect(graph.slopeAt(x)).toBeCloseTo((graph.valueAt(x + h) - graph.valueAt(x - h)) / (2 * h), 7);
});

it("keeps the sine curve finite and does not connect tangent branches across 90 degrees", () => {
  const segments = sampleFunctionGraph(sine());
  expect(segments).toHaveLength(1);
  expect(segments[0]!.length).toBe(721);
  const tangent = { ...sine(), source: "tan(x)", xMax: 180, yMin: -5, yMax: 5, pointXs: [90] };
  expect(functionGraphFacts(tangent).samples[0]?.y).toBeNull();
  expect(sampleFunctionGraph(tangent)).toHaveLength(2);
  for (const segment of sampleFunctionGraph(tangent)) {
    expect(segment.every(p => p.x < 90) || segment.every(p => p.x > 90)).toBe(true);
    expect(segment.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  }
});

it("does not expose a derivative where the original real function is undefined", () => {
  const data = { ...sine(), source: "ln(x)", xMin: -2, xMax: 2, pointXs: [-1, 0, 1] };
  expect(functionGraphFacts(data).samples.slice(0, 2)).toEqual([{ x: -1, y: null, slope: null }, { x: 0, y: null, slope: null }]);
  expect(sampleFunctionGraph(data).flat().every(p => p.x > 0)).toBe(true);
});

it("validates imports, rejects executable expressions and preserves the native graph through JSON", () => {
  expect(validateFunctionGraph(sine())).toBe(true);
  for (const change of [{ source: "alert(1)" }, { source: "x.constructor" }, { angleUnit: "cm" }, { angleUnit: ["degrees"] }, { xMax: 0 }, { yMin: 5 }, { a: Infinity }, { pointXs: [0, 0] }, { pointXs: Array.from({ length: 25 }, (_, i) => i) }]) {
    expect(validateFunctionGraph({ ...sine(), ...change })).toBe(false);
  }
  const object = createObject("function-graph");
  if (object.type !== "function-graph") throw Error("Wrong object");
  object.data = sine();
  const doc = { schemaVersion: 1, id: "graph-doc", title: "Seno", updatedAt: new Date().toISOString(), objects: [object] };
  expect(parseDocument(JSON.parse(JSON.stringify(doc)) as unknown).objects[0]).toEqual(object);
});
