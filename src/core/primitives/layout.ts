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
