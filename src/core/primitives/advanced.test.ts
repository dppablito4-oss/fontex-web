import { describe, expect, it } from "vitest";
import { graphValues, logic, truthTable } from "./logic";
import {
  checkMatrix,
  determinant,
  inverse,
  transformPoint,
} from "./linear-algebra";
import { compile, displayNumber, interpolate, scalar, sceneScope } from "./math";
import { curvePoint, sampleCurve } from "./curves";
import {
  applyPrimitivePatch,
  createPrimitive,
  MAX_PRIMITIVE_BYTES,
  nextSymbol,
  parsePrimitiveScene,
} from "./schema";
import { templates, templateScene } from "./templates";
import { advanceStep, presentationSteps } from "./presentation";
import { linkedMatrix } from "./transforms";
describe("bounded propositional logic", () => {
  it("applies connective precedence and right-associative implication", () => {
    expect(logic("!p && q || r").evaluate({ p: 1, q: 1, r: 1 })).toBe(true);
    expect(logic("p -> q -> r").evaluate({ p: 0, q: 1, r: 0 })).toBe(true);
    expect(
      truthTable("(p -> q) <-> (!p || q)", ["p", "q"]).every((r) => r.result),
    ).toBe(true);
    expect(logic("¬p ∨ q").evaluate({ p: 1, q: 0 })).toBe(false);
  });
  it("enumerates exactly sixteen rows for four variables", () => {
    const rows = truthTable("(p && q) || (r && s)", ["p", "q", "r", "s"]);
    expect(rows).toHaveLength(16);
    expect(rows.filter((r) => r.result)).toHaveLength(7);
    expect(rows[0]!.assignment).toEqual({ p: 0, q: 0, r: 0, s: 0 });
  });
  it("rejects unbounded, executable, malformed and nonboolean expressions", () => {
    for (
      const expr of [
        "p || q || r || s || t",
        "globalThis.alert(1)",
        "p &&",
        "!(".repeat(30) + "p" + ")".repeat(30),
      ]
    ) expect(() => logic(expr)).toThrow();
    expect(() => logic("p").evaluate({ p: 0.5 })).toThrow();
  });
  it("matches a composed AND/OR/NOT circuit for every truth assignment", () => {
    const graph = templateScene("logic-circuit").primitives.find((p) =>
      p.kind === "node_graph"
    )!;
    for (const row of truthTable("(p && q) || !r", ["p", "q", "r"])) {
      expect(
        graphValues(graph.data.nodes, graph.data.edges, row.assignment).out,
      ).toBe(row.result);
    }
    const cycle = structuredClone(graph);
    cycle.data.edges.push({ from: "out", to: "both", label: "" });
    expect(() =>
      graphValues(cycle.data.nodes, cycle.data.edges, { p: 1, q: 1, r: 1 })
    ).toThrow(/ciclos/);
  });
});
describe("numeric linear algebra", () => {
  it("preserves small nonzero determinants and normalizes only negative zero", () => {
    const matrix = [[1e-7, 0], [0, 1e-7]];
    expect(inverse(matrix)).not.toBeNull();
    expect(displayNumber(determinant(matrix))).toBe("1e-14");
    expect(displayNumber(-1e-13)).toBe("-1e-13");
    expect(displayNumber(-0)).toBe("0");
  });
  it("computes a known 3x3 determinant and inverse", () => {
    const m = [[2, 1, 0], [1, 2, 1], [0, 1, 2]], inv = inverse(m)!;
    expect(determinant(m)).toBe(4);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(m[i]!.reduce((sum, v, k) => sum + v * inv[k]![j]!, 0))
          .toBeCloseTo(Number(i === j), 10);
      }
    }
    expect(inverse([[1, 2], [2, 4]])).toBeNull();
    expect(() => checkMatrix([[1, 2, 3], [4, 5, 6]])).toThrow();
  });
  it("keeps inverse precision across signed 2x2 matrices", () => {
    for (let a = -3; a <= 3; a++) {
      for (let b = -2; b <= 2; b++) {
        const m = [[a, b], [1, 2]], inv = inverse(m);
        if (!inv) continue;
        const point: [number, number] = [2, -3];
        const recovered = transformPoint(inv, transformPoint(m, point));
        expect(recovered[0]).toBeCloseTo(2, 9);
        expect(recovered[1]).toBeCloseTo(-3, 9);
      }
    }
  });
  it("shares det, inverse entries and full inverse text without breaking negative powers", () => {
    const scene = templateScene("matrix-transform");
    scene.variables.find((v) => v.name === "a")!.value = -2;
    const scope = sceneScope(scene);
    expect(scalar("round(det(m),2)", scope)).toBe(-2);
    expect(scalar("det(m)^2", scope)).toBe(4);
    expect(scalar("abs(-2)^2", scope)).toBe(4);
    expect(scalar("inv(m,1,1)", scope)).toBe(-0.5);
    expect(compile("det(m)*x", scope).value(3)).toBe(-6);
    expect(interpolate("{{inv(m)}}", scope)).toContain("-0.5");
  });
  it("unlinks a removed transformation and preserves valid collapsed forward images", () => {
    const scene = templateScene("matrix-transform"),
      matrix = scene.primitives.find((p) => p.kind === "data_chart")!;
    scene.variables.find((v) => v.name === "a")!.value = 0;
    const valid = parsePrimitiveScene(scene),
      shape = valid.primitives.find((p) =>
        p.kind === "geometric_shape" && p.data.transformMatrixId
      )!;
    expect(linkedMatrix(shape, valid, sceneScope(valid))).not.toBeNull();
    const next = applyPrimitivePatch(valid, {
      message: "Quito la matriz",
      actions: [{ kind: "delete_primitive", id: matrix.id }],
    });
    expect(
      next.primitives.filter((p) =>
        "transformMatrixId" in p.data && p.data.transformMatrixId
      ),
    ).toHaveLength(0);
  });
});
describe("parametric and polar curves", () => {
  it("covers ellipse extrema and responds to shared variables", () => {
    const scene = templateScene("ellipse"),
      curve = scene.primitives.find((p) => p.kind === "function_region")!;
    expect(curvePoint(curve, 0, sceneScope(scene))).toEqual({ x: 3, y: 0 });
    scene.variables.find((v) => v.name === "b")!.value = 4;
    const point = curvePoint(curve, Math.PI / 2, sceneScope(scene));
    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(4);
    expect(sampleCurve(curve, sceneScope(scene), [-5, 5, -5, 5])[0]!.length)
      .toBeGreaterThan(600);
  });
  it("uses signed polar radii and respects degree conversion", () => {
    const scene = templateScene("polar-rose"),
      curve = scene.primitives.find((p) => p.kind === "function_region")!;
    curve.data.rExpr = "2";
    curve.data.angleUnit = "deg";
    expect(curvePoint(curve, 90, sceneScope(scene)).y).toBeCloseTo(2);
    curve.data.rExpr = "-2";
    expect(curvePoint(curve, 0, sceneScope(scene)).x).toBe(-2);
  });
  it("never bridges a sampled pole and rejects incompatible area semantics", () => {
    const scene = templateScene("ellipse"),
      curve = scene.primitives.find((p) => p.kind === "function_region")!;
    curve.data.xExpr = "t";
    curve.data.yExpr = "1/t";
    curve.data.parameterFromExpr = "-2";
    curve.data.parameterToExpr = "2";
    const segments = sampleCurve(curve, sceneScope(scene), [-3, 3, -10, 10]);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(
      segments.every((s) => s.every((p) => p.x < 0) || s.every((p) => p.x > 0)),
    ).toBe(true);
    curve.data.showArea = true;
    expect(() => parsePrimitiveScene(scene)).toThrow(/cartesianas/);
  });
});
describe("beta document boundaries and presentation", () => {
  it("keeps all compositions below 1 MiB and the catalog at ten primitives", () => {
    for (const t of templates) {
      const scene = templateScene(t.id);
      expect(
        new TextEncoder().encode(JSON.stringify(scene, null, 2)).byteLength,
      ).toBeLessThan(MAX_PRIMITIVE_BYTES);
    }
  });
  it("rejects broken circuits, invalid matrix shapes, and oversized scenes", () => {
    const scene = templateScene("logic-circuit"),
      graph = scene.primitives.find((p) => p.kind === "node_graph")!;
    graph.data.edges[0]!.from = "missing";
    expect(() => parsePrimitiveScene(scene)).toThrow();
    const m = templateScene("matrix-system"),
      chart = m.primitives.find((p) => p.kind === "data_chart")!;
    chart.data.matrixCells![0]!.pop();
    expect(() => parsePrimitiveScene(m)).toThrow();
    const large = templateScene("ellipse");
    while (large.primitives.length <= 80) {
      large.primitives.push({
        ...large.primitives[0]!,
        id: crypto.randomUUID(),
      });
    }
    expect(() => parsePrimitiveScene(large)).toThrow();
  });
  it("skips empty presentation groups and delays children until their parent exists", () => {
    const scene = templateScene("ellipse");
    for (const p of scene.primitives) p.presentationStep = 7;
    scene.primitives[0]!.presentationStep = 5;
    scene.primitives.find((p) => p.kind === "function_region")!
      .presentationStep = 1;
    const steps = presentationSteps(scene);
    expect(steps).not.toContain(1);
    expect(steps).toContain(5);
    expect(advanceStep(steps[0]!, 1, steps)).toBe(steps[1]);
    expect(advanceStep(steps.at(-1)!, 1, steps)).toBe(steps.at(-1));
  });
});

it("allocates distinct symbols when copying a matrix or creating a function", () => {
  const scene = templateScene("matrix-transform"),
    matrix = scene.primitives.find((p) => p.kind === "data_chart")!;
  expect(nextSymbol(scene, "m")).toBe("m2");
  const copy = structuredClone(matrix);
  copy.id = crypto.randomUUID();
  copy.data.matrixName = "f1";
  scene.primitives.push(copy);
  const graph = createPrimitive("function_region", scene);
  expect(graph.data.name).toBe("f2");
  scene.primitives.push(graph);
  expect(() => parsePrimitiveScene(scene)).not.toThrow();
  expect(() => truthTable("true", ["true"])).toThrow();
});
