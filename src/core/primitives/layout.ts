import { lessonSequence } from "./lesson-flow.ts";
import type { Primitive, PrimitiveScene } from "./schema.ts";

/** A single plot keeps its lesson and controls in its own floating toolbar. */
export function plotCompanions(scene: PrimitiveScene, canvasId: string): Primitive[] {
  const roots = scene.primitives.filter((p) => !("canvasId" in p.data && p.data.canvasId));
  const plots = roots.filter((p) => p.kind === "coordinate_canvas");
  if (plots.length !== 1 || plots[0]!.id !== canvasId || roots.some((p) =>
    !["coordinate_canvas", "math_block", "control_slider"].includes(p.kind)
  )) return [];
  const companions = roots.filter((p) => p.kind === "math_block" || p.kind === "control_slider");
  // Explanations for successive stages belong in the reading flow, not in a
  // collapsed panel over the diagram. Single-stage explorations keep their tools.
  if (companions.some(p => p.presentationStep !== plots[0]!.presentationStep)) return [];
  return companions;
}

export function workspaceRoots(scene: PrimitiveScene): Primitive[] {
  const embedded = new Set(scene.primitives.flatMap((p) =>
    p.kind === "coordinate_canvas" ? plotCompanions(scene, p.id).map((n) => n.id) : []
  ));
  return scene.primitives.filter((p) => !("canvasId" in p.data && p.data.canvasId) && !embedded.has(p.id));
}

/** Resize a row once, so three side-by-side diagrams do not shift text three times. */
export function fitPrimitiveHeight(scene: PrimitiveScene, id: string, height: number): PrimitiveScene {
  const p = scene.primitives.find(n => n.id === id);
  if (!p || Math.abs(p.height-height) < 4 || (!p.autoHeight && height <= p.height)) return scene;
  const roots = workspaceRoots(scene), rootIds = new Set(roots.map(n => n.id));
  const overlaps = (a: Primitive, b: Primitive) => a.x < b.x+b.width && a.x+a.width > b.x;
  const row = roots.filter(n => n.id === id || Math.abs(n.y-p.y) < 4 && !overlaps(n,p));
  const before = Math.max(p.y+p.height, ...row.map(n => n.y+n.height));
  const after = Math.max(p.y+height, ...row.filter(n => n.id !== id).map(n => n.y+n.height));
  const delta = after-before;
  return { ...scene, primitives: scene.primitives.map(n => n.id === id ? { ...n, height }
    : rootIds.has(n.id) && n.y >= before-1 && row.some(member => overlaps(n,member))
    ? { ...n, y: Math.max(0,n.y+delta) } : n) };
}

/** Keep each explanation immediately before its model, then continue the lesson. */
export function organizePrimitiveScene(scene: PrimitiveScene): PrimitiveScene {
  const roots = workspaceRoots(scene);
  const positions = new Map<string, Partial<Primitive>>();
  let y = 24;
  for (const item of lessonSequence(scene, roots)) {
    if (item.kind === "fraction") {
      const { lesson } = item;
      for (const text of lesson.texts) {
        const content = text.kind === "math_block" ? text.data.markdownContent : "";
        const height = Math.max(180, Math.ceil(content.length / 75) * 30 + content.split("\n").length * 12);
        positions.set(text.id, { x: 24, y, width: 1152, height, autoHeight: true, rotation: 0 });
        y += height + 16;
      }
      const ordered = lesson.equation
        ? [...lesson.equation.terms.filter(t => !t.generated).map(t => t.primitive),
          ...lesson.figures.filter(p => !lesson.equation!.terms.some(t => t.primitive.id === p.id))]
        : lesson.figures;
      ordered.forEach((p,index) => positions.set(p.id, { x: 24 + index % 3 * 384, y: y + Math.floor(index / 3) * 244,
        width: 360, height: 220, autoHeight: true, rotation: 0 }));
      y += Math.ceil(ordered.length / 3) * 244 + 16;
    } else {
      const p = item.primitive;
      const height = p.kind === "solid_3d" ? 540 : p.kind === "coordinate_canvas" ? 790 : p.kind === "math_block"
        ? Math.max(180, Math.ceil(p.data.markdownContent.length / 75) * 30 + p.data.markdownContent.split("\n").length * 12)
        : p.kind === "control_slider" ? 150 : p.kind === "answer_field" ? 180 : p.kind === "node_graph" ? 420 : 380;
      positions.set(p.id, { x: 24, y, width: 1152, height, autoHeight: true, rotation: 0 });
      y += height + 24;
    }
  }
  return { ...scene, primitives: scene.primitives.map((p) => positions.has(p.id) && !p.locked ? { ...p, ...positions.get(p.id) } as Primitive : p) };
}
