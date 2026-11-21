import { expect, it } from "vitest";
import {
  defaultCamera,
  type Mesh3D,
  meshRadius,
  orbitCamera,
  projectSolid,
  solidDimensions,
  solidMesh,
  solidMetrics,
  solidTypes,
} from "./solid-geometry";
import {
  applyPrimitivePatch,
  createPrimitive,
  newPrimitiveScene,
  parsePrimitiveScene,
} from "./schema";
import { sceneScope } from "./math";
import { applyPracticeValue, validatePracticeAttempt } from "./practice";

function meshVolume(mesh: Mesh3D) {
  let result = 0;
  for (const face of mesh.faces) {
    for (let i = 1; i < face.length - 1; i++) {
      const a = mesh.vertices[face[0]!]!,
        b = mesh.vertices[face[i]!]!,
        c = mesh.vertices[face[i + 1]!]!;
      result += (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    }
  }
  return result;
}
it.each(solidTypes)(
  "constructs a closed, oriented %s with a geometrically correct volume",
  (solid) => {
    const dimensions = solidDimensions({
      solid,
      widthExpr: "4",
      depthExpr: "2",
      heightExpr: "3",
      radiusExpr: "2",
    }, {});
    const mesh = solidMesh(solid, dimensions),
      metrics = solidMetrics(solid, dimensions),
      edges = new Map<string, number>();
    for (const face of mesh.faces) {
      for (let i = 0; i < face.length; i++) {
        const key = [face[i]!, face[(i + 1) % face.length]!].sort((a, b) =>
          a - b
        ).join(":");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
    expect(mesh.vertices.every((point) => point.every(Number.isFinite))).toBe(
      true,
    );
    expect(mesh.faces.length).toBeLessThanOrEqual(512);
    expect(meshVolume(mesh) / metrics.volume).toBeGreaterThan(.97);
    expect(meshVolume(mesh) / metrics.volume).toBeLessThanOrEqual(1.00001);
    const projected = projectSolid(mesh, defaultCamera);
    expect(
      projected.every((face, i) =>
        face.points.every((p) => p.every(Number.isFinite)) &&
        (i === 0 || face.depth >= projected[i - 1]!.depth)
      ),
    ).toBe(true);
  },
);
it("calculates independent reference areas and volumes for the six solids", () => {
  const d = { width: 4, height: 3, depth: 2, radius: 2 };
  expect(solidMetrics("cube", d)).toEqual({ area: 96, volume: 64 });
  expect(solidMetrics("cuboid", d)).toEqual({ area: 52, volume: 24 });
  expect(solidMetrics("pyramid", d).volume).toBe(8);
  expect(solidMetrics("pyramid", d).area).toBeCloseTo(
    8 + 4 * Math.sqrt(10) + 2 * Math.sqrt(13),
  );
  expect(solidMetrics("sphere", d).area).toBeCloseTo(16 * Math.PI);
  expect(solidMetrics("sphere", d).volume).toBeCloseTo(32 * Math.PI / 3);
  expect(solidMetrics("cylinder", d)).toEqual({
    area: 20 * Math.PI,
    volume: 12 * Math.PI,
  });
  expect(solidMetrics("cone", d).volume).toBeCloseTo(4 * Math.PI);
  expect(solidMetrics("cone", d).area).toBeCloseTo(
    2 * Math.PI * (2 + Math.sqrt(13)),
  );
});
it("rotates XYZ geometry in perspective while preserving dimensions and bounding camera input", () => {
  const mesh = solidMesh("pyramid", {
      width: 4,
      height: 3,
      depth: 2,
      radius: 1,
    }),
    copy = structuredClone(mesh);
  const before = projectSolid(mesh, defaultCamera),
    after = projectSolid(mesh, orbitCamera(defaultCamera, 75, 40));
  expect(after.map((f) => f.points)).not.toEqual(before.map((f) => f.points));
  expect(mesh).toEqual(copy);
  expect(meshRadius(mesh)).toBeGreaterThan(0);
  expect(orbitCamera(defaultCamera, 10000, 10000).pitch).toBe(85);
  expect(orbitCamera(defaultCamera, -10000, -10000).yaw).toBeGreaterThanOrEqual(
    -180,
  );
});
it("links solid measures to variables, text/table results and atomic JSON patches", () => {
  const scene = newPrimitiveScene(), solid = createPrimitive("solid_3d", scene);
  solid.data.widthExpr = "a";
  solid.interaction = { fields: ["var:a"] };
  scene.primitives.push(solid);
  const second = createPrimitive("solid_3d", scene);
  scene.primitives.push(second);
  expect(second.data.volumeName).not.toBe(solid.data.volumeName);
  const chart = createPrimitive("data_chart", scene);
  chart.data.rows = [{
    label: "Volumen",
    xExpr: "1",
    valueExpr: solid.data.volumeName,
  }];
  scene.primitives.push(chart);
  const changed = applyPracticeValue(
    parsePrimitiveScene(scene),
    solid.id,
    "var:a",
    "2",
  );
  expect(sceneScope(changed)[solid.data.volumeName]).toBe(8);
  expect(sceneScope(changed)[solid.data.areaName]).toBe(24);
  expect(validatePracticeAttempt(scene, changed)).toEqual(changed);
  expect(() => applyPracticeValue(scene, solid.id, "camera.yaw", "10")).toThrow(
    /docente/,
  );
  const invalid = structuredClone(solid);
  invalid.data.widthExpr = "0";
  expect(() =>
    applyPrimitivePatch(scene, {
      message: "bad",
      actions: [{ kind: "update_primitive", primitive: invalid }],
    })
  ).toThrow(/medidas/);
  expect(scene.primitives[0]).toEqual(solid);
  const duplicate = structuredClone(second);
  duplicate.data.volumeName = solid.data.volumeName;
  expect(() =>
    parsePrimitiveScene({ ...scene, primitives: [solid, duplicate] })
  ).toThrow(/resultado 3D/);
});
it.each(["0", "-1", "1/0", "10001", "missing"])(
  "rejects an invalid active dimension %s",
  (source) => {
    const scene = newPrimitiveScene(),
      solid = createPrimitive("solid_3d", scene);
    solid.data.widthExpr = source;
    scene.primitives.push(solid);
    expect(() => parsePrimitiveScene(scene)).toThrow();
  },
);
it("resolves a curve linked to a solid even when its result is drawn first", () => {
  const scene = newPrimitiveScene(), solid = createPrimitive("solid_3d", scene);
  solid.data.widthExpr = "2";
  const plane = createPrimitive("coordinate_canvas", scene);
  scene.primitives.push(plane);
  const curve = createPrimitive("function_region", scene);
  curve.data.canvasId = plane.id;
  curve.data.expression = solid.data.volumeName;
  curve.data.fromExpr = "0";
  curve.data.toExpr = "2";
  scene.primitives.push(curve, solid);
  expect(sceneScope(parsePrimitiveScene(scene))[curve.data.resultName])
    .toBeCloseTo(16);
  solid.data.widthExpr = curve.data.resultName;
  expect(() => parsePrimitiveScene(scene)).toThrow(/Variable no definida/);
});
