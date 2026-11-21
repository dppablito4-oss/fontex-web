import { describe, expect, it } from "vitest";
import {
  compile,
  factors,
  integrate,
  interpolate,
  niceTicks,
  polygonMetrics,
  scalar,
  sceneFunctions,
  sceneScope,
  shadeContours,
  simplifyStroke,
} from "./math";
import {
  applyPrimitivePatch,
  createPrimitive,
  newPrimitiveScene,
  parsePrimitiveScene,
  primitiveNames,
} from "./schema";
import { templates, templateScene } from "./templates";
describe("composable scene contract", () => {
  it.each(templates.map((t) => t.id))(
    "validates and roundtrips the %s template",
    (id) => {
      const scene = templateScene(id);
      expect(parsePrimitiveScene(JSON.parse(JSON.stringify(scene)))).toEqual(
        scene,
      );
    },
  );
  it("supports all twelve families with a real coordinate parent", () => {
    const scene = newPrimitiveScene();
    for (
      const kind of Object.keys(
        primitiveNames,
      ) as (keyof typeof primitiveNames)[]
    ) scene.primitives.push(createPrimitive(kind, scene));
    expect(parsePrimitiveScene(scene).primitives).toHaveLength(12);
  });
  it("rejects broken references and duplicate symbols", () => {
    const scene = templateScene("calculus");
    const broken = structuredClone(scene);
    broken.primitives = broken.primitives.filter((p) =>
      p.kind !== "coordinate_canvas"
    );
    expect(() => parsePrimitiveScene(broken)).toThrow(/referencia/);
    const circle = createPrimitive("geometric_shape", scene);
    circle.data.shape = "circle_fraction";
    circle.data.canvasId = scene.primitives[0]!.id;
    expect(() =>
      parsePrimitiveScene({
        ...scene,
        primitives: [...scene.primitives, circle],
      })
    ).toThrow(/plano/);
    scene.variables.push({ ...scene.variables[0]! });
    expect(() => parsePrimitiveScene(scene)).toThrow(/repetid/);
  });
  it("applies a patch atomically and removes a coordinate parent's children", () => {
    const scene = templateScene("calculus"), before = JSON.stringify(scene);
    const existing = scene.primitives[0]!;
    expect(() =>
      applyPrimitivePatch(scene, {
        message: "bad",
        actions: [{ kind: "delete_primitive", id: existing.id }, {
          kind: "add_primitive",
          primitive: existing,
        }, { kind: "add_primitive", primitive: existing }],
      })
    ).toThrow();
    expect(JSON.stringify(scene)).toBe(before);
    const next = applyPrimitivePatch(scene, {
      message: "remove",
      actions: [{ kind: "delete_primitive", id: existing.id }],
    });
    expect(next.primitives.some((p) => p.kind === "function_region")).toBe(
      false,
    );
  });
  it("rejects unknown fields, executable input and unsafe ranges", () => {
    const scene = templateScene("calculus");
    expect(() => parsePrimitiveScene({ ...scene, code: "alert(1)" })).toThrow();
    scene.variables[0]!.step = 0;
    expect(() => parsePrimitiveScene(scene)).toThrow();
    expect(() => compile("window.alert(1)", {})).toThrow();
    expect(() => scalar("constructor(1)", {})).toThrow();
  });
});
describe("shared mathematical context", () => {
  it("handles named variables, scientific notation and nested scalar helpers", () => {
    expect(scalar("round(abs(theta)+sqrt(4),2)", { theta: -1.234 })).toBe(3.23);
    expect(scalar("x_0+1e3", { x_0: 2 })).toBe(1002);
    expect(scalar("round(sin(pi/2),3)", {})).toBe(1);
    expect(scalar("gcd(12,18)", {})).toBe(6);
    expect(scalar("lcm(12,18)", {})).toBe(36);
    expect(() => scalar("x+1", {})).toThrow();
  });
  it("links values, functions and area text to the same variable", () => {
    const scene = templateScene("calculus"), first = sceneScope(scene);
    expect(first.area).toBeCloseTo(8 / 3, 8);
    scene.variables[0]!.value = 3;
    const next = sceneScope(scene);
    expect(next.area).toBeCloseTo(8, 8);
    expect(
      interpolate(
        "A={{round(area,2)}}; f(2)={{f(2)}}",
        next,
        sceneFunctions(scene),
      ),
    ).toBe("A=8; f(2)=12");
  });
  it("differentiates with the correct degree chain factor", () => {
    const graph = compile("a*sin(x)", { a: 2 }, "deg");
    expect(graph.value(90)).toBeCloseTo(2);
    expect(graph.slope(0)).toBeCloseTo(2 * Math.PI / 180);
  });
  it("integrates polynomial and reversed limits with a finite estimate", () => {
    const r = integrate((x) => x * x, 0, 1);
    expect(r.status).toBe("finite");
    if (r.status === "finite") {
      expect(r.value).toBeCloseTo(1 / 3, 10);
      expect(r.error).toBeLessThan(1e-7);
    }
    const reverse = integrate((x) => x * x, 1, 0);
    if (reverse.status === "finite") {
      expect(reverse.value).toBeCloseTo(-1 / 3, 10);
    }
  });
  it("distinguishes signed integral from geometric area across a crossing", () => {
    const signed = integrate((x) => x, -1, 1),
      area = integrate((x) => x, -1, 1, true);
    if (signed.status === "finite") expect(signed.value).toBeCloseTo(0);
    if (area.status === "finite") expect(area.value).toBeCloseTo(1);
  });
  it("rejects singularities and undefined domains", () => {
    expect(integrate((x) => 1 / x, -1, 1).status).not.toBe("finite");
    expect(integrate((x) => Math.log(x), -1, 2).status).not.toBe("finite");
    expect(integrate((x) => 1 / (x - .33331), 0, 1).status).not.toBe("finite");
  });
  it("reduces redundant stroke points while preserving endpoints", () => {
    const points: [number, number][] = Array.from(
      { length: 300 },
      (_, i) => [i, i],
    );
    const r = simplifyStroke(points);
    expect(r).toEqual([[0, 0], [299, 299]]);
  });
});

it("calculates simple concave polygons and rejects crossed boundaries", () => {
  const result = polygonMetrics([[0, 0], [4, 0], [2, 1], [4, 4], [0, 4]]);
  expect(result.area).toBe(12);
  expect(result.angles.some((a) => a > 180)).toBe(true);
  expect(() => polygonMetrics([[0, 0], [3, 3], [0, 3], [3, 0]])).toThrow(
    /cruzarse/,
  );
});
it("formats prime factorization without executable content", () => {
  expect(factors(360)).toBe("2³ · 3² · 5");
  expect(interpolate("{{factors(n)}}", { n: 36 })).toBe("2² · 3²");
  expect(() => factors(1)).toThrow();
});
it("loads an explicit template atomically while retaining identity and chat", () => {
  const scene = newPrimitiveScene();
  scene.conversation = [{ role: "user", content: "Una idea" }];
  const next = applyPrimitivePatch(scene, {
    message: "Plantilla",
    actions: [{ kind: "load_template", templateId: "calculus" }],
  }, templateScene);
  expect(next.id).toBe(scene.id);
  expect(next.conversation).toEqual(scene.conversation);
  expect(next.primitives.some((p) => p.kind === "function_region")).toBe(true);
  expect(() =>
    applyPrimitivePatch(scene, {
      message: "x",
      actions: [{ kind: "load_template", templateId: "unknown" }],
    }, templateScene)
  ).toThrow();
  expect(scene.primitives).toEqual([]);
});
it("keeps shaded regions visible when the function extends above the viewport", () => {
  const paths = shadeContours((x) => 3 * x * x, () => 0, 0, 2, -3, 5);
  expect(paths).toHaveLength(1);
  expect(Math.max(...paths[0]!.map((p) => p.x))).toBe(2);
  expect(Math.max(...paths[0]!.map((p) => p.y))).toBeLessThanOrEqual(5.8);
});

it("uses concise responsive axis ticks without repeating decimal labels", () => {
  expect(niceTicks(-.5, 2.5, 3)).toEqual([0, 1, 2]);
  expect(niceTicks(-22, 22, 5)).toEqual([-20, -10, 0, 10, 20]);
  expect(niceTicks(0, 0)).toEqual([]);
});

describe("v0.7.1 curriculum compositions", () => {
  it("has 40 distinct templates with guided practice", () => {
    expect(templates).toHaveLength(40);
    expect(new Set(templates.map((t) => t.id)).size).toBe(40);
  });
  it("keeps old v2 vectors compatible and validates optional jump heights", () => {
    const scene = templateScene("number-jumps");
    const vector = scene.primitives.find((p) => p.kind === "vector_segment")!;
    expect(vector.data.arcHeight).toBeGreaterThan(0);
    delete vector.data.arcHeight;
    expect(() => parsePrimitiveScene(scene)).not.toThrow();
    vector.data.arcHeight = null;
    expect(() => parsePrimitiveScene(scene)).not.toThrow();
    vector.data.arcHeight = 121;
    expect(() => parsePrimitiveScene(scene)).toThrow();
  });
  it("updates signed number-line displacements when the second addend is negative", () => {
    const scene = templateScene("number-jumps");
    scene.variables.find((v) => v.name === "b")!.value = -4;
    const valid = parsePrimitiveScene(scene), scope = sceneScope(valid);
    const jumps = valid.primitives.filter((p) => p.kind === "vector_segment");
    expect(scalar(jumps[1]!.data.end[0], scope)).toBe(-1);
    expect(
      scalar(jumps[1]!.data.end[0], scope) -
        scalar(jumps[1]!.data.start[0], scope),
    ).toBe(-4);
  });
  it("keeps the unit radius and handles undefined tangent at a right angle", () => {
    const scene = templateScene("unit-circle");
    scene.variables[0]!.value = 90;
    const valid = parsePrimitiveScene(scene), scope = sceneScope(valid);
    const radius = valid.primitives.find((p) => p.kind === "vector_segment")!;
    const [x, y] = radius.data.end.map((expr) => scalar(expr, scope));
    expect(Math.hypot(x!, y!)).toBeCloseTo(1);
    expect(interpolate("{{tan(rad(theta))}}", scope)).toBe("No definido");
  });
  it("calculates the 3-4-5 triangle and complementary acute angles", () => {
    const scene = templateScene("pythagoras"), scope = sceneScope(scene);
    expect(scalar("sqrt(a^2+b^2)", scope)).toBe(5);
    expect(scalar("deg(atan2(b,a))+deg(atan2(a,b))", scope)).toBeCloseTo(90);
    scene.variables[0]!.value = 8;
    expect(() => parsePrimitiveScene(scene)).not.toThrow();
  });
});
