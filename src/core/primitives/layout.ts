import { fractionLessons } from "./fraction-lessons.ts";
import type { Primitive, PrimitiveScene } from "./schema.ts";

/** A single plot keeps its lesson and controls in its own floating toolbar. */
export function plotCompanions(scene: PrimitiveScene, canvasId: string): Primitive[] {
  const roots = scene.primitives.filter((p) => !("canvasId" in p.data && p.data.canvasId));
  const plots = roots.filter((p) => p.kind === "coordinate_canvas");
  if (plots.length !== 1 || plots[0]!.id !== canvasId || roots.some((p) =>
    !["coordinate_canvas", "math_block", "control_slider"].includes(p.kind)
  )) return [];
  return roots.filter((p) => p.kind === "math_block" || p.kind === "control_slider");
}

export function workspaceRoots(scene: PrimitiveScene): Primitive[] {
  const embedded = new Set(scene.primitives.flatMap((p) =>
    p.kind === "coordinate_canvas" ? plotCompanions(scene, p.id).map((n) => n.id) : []
  ));
  return scene.primitives.filter((p) => !("canvasId" in p.data && p.data.canvasId) && !embedded.has(p.id));
}

/** Give figures the full width; explanations never force a narrow plot column. */
export function organizePrimitiveScene(scene: PrimitiveScene): PrimitiveScene {
  const roots = workspaceRoots(scene);
  const lessons = fractionLessons(scene, roots);
  if (lessons.length) {
    const positions = new Map<string, Partial<Primitive>>();
    let y = 24;
    for (const lesson of lessons) {
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
    }
    for (const p of roots.filter(p => !positions.has(p.id)).sort((a,b) => a.y-b.y || a.x-b.x)) {
      const height = p.kind === "coordinate_canvas" ? 790 : p.kind === "math_block" ? 180 : 260;
      positions.set(p.id, { x: 24, y, width: 1152, height, autoHeight: true, rotation: 0 });
      y += height + 24;
    }
    return { ...scene, primitives: scene.primitives.map(p => positions.has(p.id) && !p.locked ? { ...p, ...positions.get(p.id) } as Primitive : p) };
  }
  const controls = roots.filter((p) => p.kind === "control_slider");
  const texts = roots.filter((p) => p.kind === "math_block");
  const visuals = roots.filter((p) => p.kind !== "control_slider" && p.kind !== "math_block");
  const positions = new Map<string, Partial<Primitive>>();
  let visualY = 24, sideY = 24;
  for (const p of visuals) {
    const width = 1152;
    const height = p.kind === "coordinate_canvas" ? 790 : p.kind === "node_graph" ? 420 : 380;
    positions.set(p.id, { x: 24, y: visualY, width, height, autoHeight: true, rotation: 0 });
    visualY += height + 24;
  }
  for (const p of controls) {
    positions.set(p.id, { x: 24, y: visualY + sideY - 24, width: 1152, height: 150, autoHeight: true, rotation: 0 });
    sideY += 174;
  }
  let bottom = visualY + sideY;
  for (const p of texts) {
    positions.set(p.id, { x: 24, y: bottom, width: 1152, height: 160, autoHeight: true, rotation: 0 });
    bottom += 184;
  }
  return { ...scene, primitives: scene.primitives.map((p) => positions.has(p.id) && !p.locked ? { ...p, ...positions.get(p.id) } as Primitive : p) };
}
