import { type FunctionDefinition, scalar, type Scope } from "./math.ts";

export const solidTypes = [
  "cube",
  "cuboid",
  "pyramid",
  "sphere",
  "cylinder",
  "cone",
] as const;
export type SolidType = typeof solidTypes[number];
export const solidLabels: Record<SolidType, string> = {
  cube: "Cubo",
  cuboid: "Prisma rectangular",
  pyramid: "Pirámide",
  sphere: "Esfera",
  cylinder: "Cilindro",
  cone: "Cono",
};
export type Vec3 = [number, number, number];
export type Mesh3D = { vertices: Vec3[]; faces: number[][] };
export type SolidSpec = {
  solid: SolidType;
  widthExpr: string;
  heightExpr: string;
  depthExpr: string;
  radiusExpr: string;
};
export type SolidDimensions = {
  width: number;
  height: number;
  depth: number;
  radius: number;
};
export type Camera3D = { yaw: number; pitch: number; zoom: number };
export const defaultCamera: Camera3D = { yaw: 35, pitch: 20, zoom: 1 };
export function solidDimensions(
  data: SolidSpec,
  scope: Scope,
  functions: Record<string, FunctionDefinition> = {},
): SolidDimensions {
  const value = (source: string) => {
    const n = scalar(source, scope, functions);
    if (n < .0001 || n > 10000) {
      throw Error("Las medidas del cuerpo deben estar entre 0.0001 y 10000.");
    }
    return n;
  };
  const radial = ["sphere", "cylinder", "cone"].includes(data.solid);
  const width = radial ? 1 : value(data.widthExpr);
  return {
    width,
    depth: data.solid === "cube" ? width : radial ? 1 : value(data.depthExpr),
    height: data.solid === "cube"
      ? width
      : data.solid === "sphere"
      ? 1
      : value(data.heightExpr),
    radius: radial ? value(data.radiusExpr) : 1,
  };
}
export function solidMetrics(
  type: SolidType,
  d: SolidDimensions,
): { area: number; volume: number } {
  const { width: w, height: h, depth: z, radius: r } = d;
  switch (type) {
    case "cube":
      return { area: 6 * w * w, volume: w ** 3 };
    case "cuboid":
      return { area: 2 * (w * h + w * z + h * z), volume: w * h * z };
    case "pyramid":
      return {
        area: w * z + w * Math.hypot(h, z / 2) + z * Math.hypot(h, w / 2),
        volume: w * z * h / 3,
      };
    case "sphere":
      return { area: 4 * Math.PI * r * r, volume: 4 * Math.PI * r ** 3 / 3 };
    case "cylinder":
      return { area: 2 * Math.PI * r * (r + h), volume: Math.PI * r * r * h };
    case "cone":
      return {
        area: Math.PI * r * (r + Math.hypot(r, h)),
        volume: Math.PI * r * r * h / 3,
      };
  }
}
const cross = (
  a: Vec3,
  b: Vec3,
): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const minus = (
  a: Vec3,
  b: Vec3,
): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function normal(points: Vec3[]): Vec3 {
  return cross(minus(points[1]!, points[0]!), minus(points[2]!, points[0]!));
}
export function solidMesh(type: SolidType, d: SolidDimensions): Mesh3D {
  const { width: w, radius: r } = d;
  const h = type === "cube" ? w : d.height, z = type === "cube" ? w : d.depth;
  const vertices: Vec3[] = [], faces: number[][] = [];
  if (type === "cube" || type === "cuboid" || type === "pyramid") {
    vertices.push([-w / 2, -h / 2, -z / 2], [w / 2, -h / 2, -z / 2], [
      w / 2,
      -h / 2,
      z / 2,
    ], [-w / 2, -h / 2, z / 2]);
    faces.push([0, 3, 2, 1]);
    if (type === "pyramid") {
      vertices.push([0, h / 2, 0]);
      for (let i = 0; i < 4; i++) faces.push([i, (i + 1) % 4, 4]);
    } else {
      vertices.push([-w / 2, h / 2, -z / 2], [w / 2, h / 2, -z / 2], [
        w / 2,
        h / 2,
        z / 2,
      ], [-w / 2, h / 2, z / 2]);
      faces.push([4, 5, 6, 7]);
      for (let i = 0; i < 4; i++) {
        faces.push([i, (i + 1) % 4, (i + 1) % 4 + 4, i + 4]);
      }
    }
  } else if (type === "sphere") {
    const rings = 16, segments = 32;
    vertices.push([0, r, 0]);
    for (let i = 1; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * Math.PI / rings, b = j * 2 * Math.PI / segments;
        vertices.push([
          r * Math.sin(a) * Math.cos(b),
          r * Math.cos(a),
          r * Math.sin(a) * Math.sin(b),
        ]);
      }
    }
    const south = vertices.length;
    vertices.push([0, -r, 0]);
    for (let j = 0; j < segments; j++) {
      faces.push([0, 1 + j, 1 + (j + 1) % segments]);
    }
    for (let i = 0; i < rings - 2; i++) {
      for (let j = 0; j < segments; j++) {
        const a = 1 + i * segments + j,
          b = 1 + i * segments + (j + 1) % segments;
        faces.push([a, b, b + segments, a + segments]);
      }
    }
    for (let j = 0; j < segments; j++) {
      faces.push([
        south,
        south - segments + j,
        south - segments + (j + 1) % segments,
      ]);
    }
  } else {
    const segments = 48;
    for (let j = 0; j < segments; j++) {
      const a = j * 2 * Math.PI / segments;
      vertices.push([r * Math.cos(a), -h / 2, r * Math.sin(a)]);
    }
    faces.push(Array.from({ length: segments }, (_, i) => i));
    if (type === "cone") {
      vertices.push([0, h / 2, 0]);
      for (let j = 0; j < segments; j++) {
        faces.push([j, (j + 1) % segments, segments]);
      }
    } else {
      for (let j = 0; j < segments; j++) {
        const a = j * 2 * Math.PI / segments;
        vertices.push([r * Math.cos(a), h / 2, r * Math.sin(a)]);
      }
      faces.push(Array.from({ length: segments }, (_, i) => i + segments));
      for (let j = 0; j < segments; j++) {
        faces.push([
          j,
          (j + 1) % segments,
          (j + 1) % segments + segments,
          j + segments,
        ]);
      }
    }
  }
  // All six solids are convex; point normals away from the interior.
  for (const face of faces) {
    const points = face.map((i) => vertices[i]!);
    if (dot(normal(points), points[0]!) < 0) face.reverse();
  }
  return { vertices, faces };
}
export function meshRadius(mesh: Mesh3D): number {
  return Math.max(.0001, ...mesh.vertices.map((v) => Math.hypot(...v)));
}
export function orbitCamera(
  camera: Camera3D,
  dx: number,
  dy: number,
): Camera3D {
  return {
    ...camera,
    yaw: ((camera.yaw + dx + 180) % 360 + 360) % 360 - 180,
    pitch: Math.max(-85, Math.min(85, camera.pitch + dy)),
  };
}
export function projectSolid(
  mesh: Mesh3D,
  camera: Camera3D,
  referenceRadius = meshRadius(mesh),
) {
  const yaw = camera.yaw * Math.PI / 180, pitch = camera.pitch * Math.PI / 180;
  const radius = Math.max(referenceRadius, meshRadius(mesh) / 2);
  const rotated = mesh.vertices.map(([x, y, z]): Vec3 => {
    const a = (x * Math.cos(yaw) + z * Math.sin(yaw)) / radius,
      b = y / radius,
      c = (-x * Math.sin(yaw) + z * Math.cos(yaw)) / radius;
    return [
      a,
      b * Math.cos(pitch) - c * Math.sin(pitch),
      b * Math.sin(pitch) + c * Math.cos(pitch),
    ];
  });
  const project = ([x, y, z]: Vec3): [number, number] => {
    const scale = 180 * camera.zoom * 4.5 / (4.5 - z);
    return [400 + x * scale, 230 - y * scale];
  };
  const light: Vec3 = [-.4, .7, 1];
  return mesh.faces.map((face, index) => {
    const points = face.map((i) => rotated[i]!),
      n = normal(points),
      length = Math.hypot(...n);
    return {
      index,
      points: points.map(project),
      depth: points.reduce((s, p) => s + p[2], 0) / points.length,
      shade: .38 +
        .62 * Math.max(0, dot(n, light) / (length * Math.hypot(...light) || 1)),
    };
  }).sort((a, b) => a.depth - b.depth);
}
