import { primitiveNames } from "./catalog.ts";
export { primitiveNames } from "./catalog.ts";
import { z } from "zod";
import {
  compile,
  polygonMetrics,
  reservedNames,
  scalar,
  sceneFunctions,
  userScope,
} from "./math.ts";
const finite = z.number().finite();
const expr = z.string().trim().min(1).max(500);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const symbol = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const pair = z.tuple([expr, expr]);
export const variableSchema = z.object({
  name: symbol,
  value: finite.min(-1e6).max(1e6),
  min: finite.min(-1e6).max(1e6),
  max: finite.min(-1e6).max(1e6),
  step: finite.positive().max(1e6),
  unit: z.string().max(20),
}).strict();
const style = z.object({
  strokeColor: color,
  fillColor: color,
  strokeWidth: finite.min(0).max(12),
  opacity: finite.min(0).max(1),
  dashed: z.boolean(),
  fontSize: finite.min(12).max(80),
}).strict();
const base = {
  id,
  autoHeight: z.boolean(),
  label: z.string().max(120),
  x: finite.min(0).max(10000),
  y: finite.min(0).max(1000000),
  width: finite.min(100).max(1600),
  height: finite.min(60).max(100000),
  rotation: finite.min(-360).max(360),
  zIndex: z.number().int().min(0).max(1000),
  locked: z.boolean(),
  presentationStep: z.number().int().min(1).max(100),
  style,
};
export const primitiveSchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("coordinate_canvas"),
    data: z.object({
      mode: z.enum([
        "cartesian",
        "polar",
        "unit_circle",
        "number_line",
        "blank_grid",
      ]),
      domainX: pair,
      rangeY: pair,
      angleUnit: z.enum(["rad", "deg"]),
      showGrid: z.boolean(),
      showAxisLabels: z.boolean(),
      subdivisions: z.number().int().min(2).max(20),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    kind: z.literal("function_region"),
    data: z.object({
      canvasId: id,
      name: symbol,
      expression: expr,
      secondaryExpression: z.string().max(500),
      angleUnit: z.enum(["rad", "deg"]),
      showDerivative: z.boolean(),
      showTangent: z.boolean(),
      tangentAt: expr,
      pointXs: z.array(expr).max(24),
      showArea: z.boolean(),
      fromExpr: expr,
      toExpr: expr,
      areaMode: z.enum(["signed", "geometric"]),
      resultName: symbol,
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    kind: z.literal("vector_segment"),
    data: z.object({
      canvasId: id.nullable(),
      start: pair,
      end: pair,
      headStart: z.enum(["arrow", "dot", "bar", "none"]),
      headEnd: z.enum(["arrow", "dot", "bar", "none"]),
      showMagnitude: z.boolean(),
      showAngleArc: z.boolean(),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    kind: z.literal("stamp_grid"),
    data: z.object({
      icon: z.enum(["apple", "star", "cube", "coin", "circle", "atom"]),
      rowsExpr: expr,
      colsExpr: expr,
      activeCountExpr: expr,
      groupBy: z.number().int().min(1).max(100),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    kind: z.literal("math_block"),
    data: z.object({
      markdownContent: z.string().max(10000),
      variant: z.enum(["card", "transparent", "callout_info", "callout_step"]),
      autoHeight: z.boolean(),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    kind: z.literal("control_slider"),
    data: z.object({
      variableName: symbol,
      controlType: z.enum(["slider", "stepper", "play_pause"]),
      speed: finite.min(.05).max(20),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    kind: z.literal("geometric_shape"),
    data: z.object({
      canvasId: id.nullable(),
      shape: z.enum([
        "triangle",
        "polygon",
        "circle_fraction",
        "sector",
        "prism",
        "cylinder",
        "inclined_plane",
        "block_mass",
      ]),
      regular: z.boolean(),
      sides: z.number().int().min(3).max(24),
      sideExpr: expr,
      radiusExpr: expr,
      divisions: z.number().int().min(1).max(48),
      shadedExpr: expr,
      verticesExpr: z.array(pair).min(3).max(24),
      unit: z.enum(["u", "mm", "cm", "m", "km"]),
      showAngles: z.boolean(),
      showSideLengths: z.boolean(),
      showCenterOfMass: z.boolean(),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    kind: z.literal("data_chart"),
    data: z.object({
      chartType: z.enum(["table_only", "bar", "histogram", "pie", "scatter"]),
      headers: z.tuple([z.string().max(60), z.string().max(60)]),
      rows: z.array(
        z.object({ label: z.string().max(60), xExpr: expr, valueExpr: expr })
          .strict(),
      ).max(200),
      showLinearRegression: z.boolean(),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    kind: z.literal("annotation_stroke"),
    data: z.object({
      mode: z.enum(["freehand", "highlighter", "callout_bubble"]),
      points: z.array(
        z.tuple([finite.min(0).max(1600), finite.min(0).max(3000)]),
      ).max(512),
      calloutText: z.string().max(2000),
    }).strict(),
  }).strict(),
]);
export const sceneSchema = z.object({
  schemaVersion: z.literal(2),
  format: z.literal("primitive-scene"),
  id: id.refine(
    (value) => !value.startsWith("import-") && value !== "canvas-workspace-v1",
    "Identidad reservada para un formato retirado.",
  ),
  title: z.string().max(160),
  level: z.enum(["inicial", "primaria", "secundaria", "universidad"]),
  updatedAt: z.iso.datetime({ offset: true }),
  variables: z.array(variableSchema).max(24),
  primitives: z.array(primitiveSchema).max(80),
  conversation: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(4000),
    }).strict(),
  ).max(80),
}).strict();
export type Primitive = z.infer<typeof primitiveSchema>;
export type PrimitiveKind = Primitive["kind"];
export type SceneVariable = z.infer<typeof variableSchema>;
export type PrimitiveScene = z.infer<typeof sceneSchema>;
export const MAX_PRIMITIVE_BYTES = 1024 * 1024;
export function parsePrimitiveScene(value: unknown): PrimitiveScene {
  const result = sceneSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Escena inválida: ${
        result.error.issues[0]?.path.join(".") ?? "contrato"
      }.`,
    );
  }
  const scene = result.data,
    ids = new Set(scene.primitives.map((p) => p.id)),
    names = new Set(scene.variables.map((v) => v.name));
  if (
    ids.size !== scene.primitives.length ||
    names.size !== scene.variables.length
  ) throw new Error("Identificadores o variables repetidos.");
  for (const v of scene.variables) {
    if (
      reservedNames.has(v.name) || v.min > v.max || v.value < v.min ||
      v.value > v.max
    ) throw new Error(`Revisa el rango o el nombre de ${v.name}.`);
  }
  const functions = scene.primitives.filter((p) =>
    p.kind === "function_region"
  );
  const outputs = new Set<string>();
  for (const p of functions) {
    if (
      reservedNames.has(p.data.name) || names.has(p.data.name) ||
      outputs.has(p.data.name)
    ) throw new Error("Nombre de función repetido o reservado.");
    outputs.add(p.data.name);
    if (p.data.showArea) {
      if (
        reservedNames.has(p.data.resultName) || names.has(p.data.resultName) ||
        outputs.has(p.data.resultName)
      ) throw new Error("Nombre de resultado repetido o reservado.");
      outputs.add(p.data.resultName);
    }
  }
  const scope = userScope(scene), defs = sceneFunctions(scene);
  for (const p of scene.primitives) {
    if ("canvasId" in p.data && p.data.canvasId !== null) {
      const parentId = p.data.canvasId;
      const parent = scene.primitives.find((n) => n.id === parentId);
      if (
        !parent || parent.kind !== "coordinate_canvas" || parent.id === p.id
      ) throw new Error("La referencia debe apuntar a un plano existente.");
    }
    if (p.kind === "function_region") {
      compile(p.data.expression, scope, p.data.angleUnit);
      if (p.data.secondaryExpression) {
        compile(p.data.secondaryExpression, scope, p.data.angleUnit);
      }
      for (
        const x of [
          p.data.fromExpr,
          p.data.toExpr,
          p.data.tangentAt,
          ...p.data.pointXs,
        ]
      ) scalar(x, scope, defs);
    }
    if (p.kind === "control_slider" && !names.has(p.data.variableName)) {
      throw new Error("El control requiere una variable existente.");
    }
    if (p.kind === "coordinate_canvas") {
      const [a, b] = p.data.domainX.map((x) => scalar(x, scope)),
        [c, d] = p.data.rangeY.map((x) => scalar(x, scope));
      if (
        b! - a! < .001 || d! - c! < .001 ||
        [a, b, c, d].some((x) => Math.abs(x!) > 10000)
      ) throw new Error("Revisa el dominio y la ventana del plano.");
    }
    if (p.kind === "vector_segment") {
      for (const x of [...p.data.start, ...p.data.end]) {
        scalar(x, scope, defs);
      }
    }
    if (p.kind === "stamp_grid") {
      const rows = scalar(p.data.rowsExpr, scope),
        cols = scalar(p.data.colsExpr, scope),
        active = scalar(p.data.activeCountExpr, scope);
      if (
        ![rows, cols, active].every(Number.isInteger) || rows < 1 || cols < 1 ||
        rows * cols > 400 || active < 0 || active > rows * cols
      ) {
        throw new Error(
          "Pictogramas: de 1 a 400 elementos y cantidad activa válida.",
        );
      }
    }
    if (
      p.kind === "geometric_shape" && !p.data.regular &&
      ["polygon", "triangle"].includes(p.data.shape)
    ) {
      polygonMetrics(
        p.data.verticesExpr.map((pair) =>
          pair.map((x) => scalar(x, scope)) as [number, number]
        ),
      );
    }
    if (p.kind === "geometric_shape") {
      const side = scalar(p.data.sideExpr, scope),
        r = scalar(p.data.radiusExpr, scope),
        slices = scalar(p.data.shadedExpr, scope);
      if (
        side <= 0 || r <= 0 || Math.max(side, r) > 10000 || slices < 0 ||
        slices > p.data.divisions * 3
      ) {
        throw new Error(
          "Revisa las medidas positivas y las porciones (hasta 3 unidades).",
        );
      }
      for (const vertex of p.data.verticesExpr) {
        for (const x of vertex) {
          if (Math.abs(scalar(x, scope)) > 10000) {
            throw new Error("Vértices fuera de rango.");
          }
        }
      }
    }
    if (p.kind === "data_chart") {
      for (const row of p.data.rows) {
        if (
          [scalar(row.xExpr, scope, defs), scalar(row.valueExpr, scope, defs)]
            .some((n) => Math.abs(n) > 1e9)
        ) throw new Error("Datos fuera de escala.");
      }
    }
  }
  if (
    new TextEncoder().encode(JSON.stringify(scene, null, 2)).byteLength >
      MAX_PRIMITIVE_BYTES
  ) throw new Error("La escena supera 1 MiB.");
  return scene;
}
export const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("upsert_variable"), variable: variableSchema })
    .strict(),
  z.object({ kind: z.literal("add_primitive"), primitive: primitiveSchema })
    .strict(),
  z.object({ kind: z.literal("update_primitive"), primitive: primitiveSchema })
    .strict(),
  z.object({ kind: z.literal("delete_primitive"), id }).strict(),
  z.object({
    kind: z.literal("load_template"),
    templateId: z.string().min(1).max(40),
  }).strict(),
]);
export const replySchema = z.object({
  message: z.string().min(1).max(4000),
  actions: z.array(actionSchema).max(40),
}).strict();
export type PrimitiveReply = z.infer<typeof replySchema>;
export function applyPrimitivePatch(
  scene: PrimitiveScene,
  value: unknown,
  resolveTemplate?: (id: string) => PrimitiveScene,
): PrimitiveScene {
  const reply = replySchema.parse(value), next = structuredClone(scene);
  for (const action of reply.actions) {
    if (action.kind === "load_template") {
      if (!resolveTemplate) {
        throw new Error("No se pudo resolver la plantilla.");
      }
      const template = resolveTemplate(action.templateId);
      next.title = template.title;
      next.level = template.level;
      next.variables = template.variables;
      next.primitives = template.primitives;
    } else if (action.kind === "upsert_variable") {
      next.variables = next.variables.filter((v) =>
        v.name !== action.variable.name
      );
      next.variables.push(action.variable);
    } else if (action.kind === "delete_primitive") {
      if (!next.primitives.some((p) => p.id === action.id)) {
        throw new Error("El objeto ya no existe.");
      }
      next.primitives = next.primitives.filter((p) =>
        p.id !== action.id &&
        !("canvasId" in p.data && p.data.canvasId === action.id)
      );
    } else {
      const exists = next.primitives.some((p) => p.id === action.primitive.id);
      if (exists !== (action.kind === "update_primitive")) {
        throw new Error(
          "La operación no coincide con el estado actual del objeto.",
        );
      }
      next.primitives = next.primitives.filter((p) =>
        p.id !== action.primitive.id
      );
      next.primitives.push(action.primitive);
    }
  }
  next.updatedAt = new Date().toISOString();
  return parsePrimitiveScene(next);
}
export function newPrimitiveScene(title = "Mi lienzo"): PrimitiveScene {
  return {
    schemaVersion: 2,
    format: "primitive-scene",
    id: crypto.randomUUID(),
    title,
    level: "secundaria",
    updatedAt: new Date().toISOString(),
    variables: [{ name: "a", value: 1, min: -5, max: 5, step: .1, unit: "" }],
    primitives: [],
    conversation: [],
  };
}
export function createPrimitive<K extends PrimitiveKind>(
  kind: K,
  scene: PrimitiveScene,
): Extract<Primitive, { kind: K }> {
  const parent = scene.primitives.find((p) => p.kind === "coordinate_canvas");
  let index = 1;
  const taken = new Set([
    ...scene.variables.map((v) => v.name),
    ...scene.primitives.flatMap((p) =>
      p.kind === "function_region" ? [p.data.name, p.data.resultName] : []
    ),
  ]);
  while (taken.has(`f${index}`) || taken.has(`area${index}`)) index++;
  const defaults = {
    coordinate_canvas: {
      mode: "cartesian",
      domainX: ["-5", "5"],
      rangeY: ["-3", "5"],
      angleUnit: "rad",
      showGrid: true,
      showAxisLabels: true,
      subdivisions: 10,
    },
    function_region: {
      canvasId: parent?.id ?? "missing",
      name: `f${index}`,
      expression: "a*x^2",
      secondaryExpression: "",
      angleUnit: "rad",
      showDerivative: false,
      showTangent: false,
      tangentAt: "1",
      pointXs: ["0", "1", "2"],
      showArea: true,
      fromExpr: "0",
      toExpr: "2",
      areaMode: "signed",
      resultName: `area${index}`,
    },
    vector_segment: {
      canvasId: null,
      start: ["40", "160"],
      end: ["300", "40"],
      headStart: "none",
      headEnd: "arrow",
      showMagnitude: true,
      showAngleArc: true,
    },
    stamp_grid: {
      icon: "apple",
      rowsExpr: "3",
      colsExpr: "4",
      activeCountExpr: "8",
      groupBy: 1,
    },
    math_block: {
      markdownContent:
        "Escribe aquí. Una variable puede cambiar este texto: **a = {{a}}**.",
      variant: "transparent",
      autoHeight: true,
    },
    control_slider: {
      variableName: scene.variables[0]?.name ?? "a",
      controlType: "slider",
      speed: 1,
    },
    geometric_shape: {
      canvasId: null,
      shape: "polygon",
      regular: true,
      sides: 6,
      sideExpr: "4",
      radiusExpr: "3",
      divisions: 4,
      shadedExpr: "3",
      verticesExpr: [["0", "0"], ["6", "0"], ["4", "3"], ["0", "4"]],
      unit: "cm",
      showAngles: false,
      showSideLengths: true,
      showCenterOfMass: false,
    },
    data_chart: {
      chartType: "bar",
      headers: ["Categoría", "Valor"],
      rows: [{ label: "A", xExpr: "1", valueExpr: "3" }, {
        label: "B",
        xExpr: "2",
        valueExpr: "5",
      }, { label: "C", xExpr: "3", valueExpr: "a*4" }],
      showLinearRegression: false,
    },
    annotation_stroke: {
      mode: "freehand",
      points: [],
      calloutText: "Escribe una nota",
    },
  };
  const roots = scene.primitives.filter((p) =>
    !("canvasId" in p.data && p.data.canvasId)
  );
  const y = Math.max(20, ...roots.map((p) => p.y + p.height + 24));
  return primitiveSchema.parse({
    id: crypto.randomUUID(),
    autoHeight: true,
    kind,
    label: primitiveNames[kind],
    x: 24,
    y,
    width: 1152,
    height: kind === "math_block"
      ? 160
      : kind === "control_slider"
      ? 100
      : kind === "coordinate_canvas"
      ? 500
      : 320,
    rotation: 0,
    zIndex: scene.primitives.length,
    locked: false,
    presentationStep: 1,
    style: {
      strokeColor: "#38a989",
      fillColor: "#a7e9d3",
      strokeWidth: 2,
      opacity: 1,
      dashed: false,
      fontSize: 22,
    },
    data: defaults[kind],
  }) as Extract<Primitive, { kind: K }>;
}
