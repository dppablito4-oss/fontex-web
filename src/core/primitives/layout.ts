import type { Primitive, PrimitiveScene } from "./schema.ts";

/** Arrange a lesson as a visual workspace, with controls beside it and reading below. */
export function organizePrimitiveScene(scene: PrimitiveScene): PrimitiveScene {
  const roots = scene.primitives.filter((p) => !("canvasId" in p.data && p.data.canvasId));
  const controls = roots.filter((p) => p.kind === "control_slider");
  const texts = roots.filter((p) => p.kind === "math_block");
  const visuals = roots.filter((p) => p.kind !== "control_slider" && p.kind !== "math_block");
  const positions = new Map<string, Partial<Primitive>>();
  let visualY = 24, sideY = 24;
  const hasSide = controls.length > 0 || texts.length > 1;
  for (const p of visuals) {
    const width = hasSide ? 744 : 1152;
    const height = p.kind === "coordinate_canvas" ? 540 : p.kind === "node_graph" ? 420 : 380;
    positions.set(p.id, { x: 24, y: visualY, width, height, autoHeight: true, rotation: 0 });
    visualY += height + 24;
  }
  for (const p of controls) {
    positions.set(p.id, { x: visuals.length ? 792 : 24, y: sideY, width: visuals.length ? 384 : 1152, height: 150, autoHeight: true, rotation: 0 });
    sideY += 174;
  }
  // Short introductions sit beside the visual. The final explanation uses the full width.
  const sideText = visuals.length && texts.length > 1 ? texts.slice(0, -1) : [];
  for (const p of sideText) {
    positions.set(p.id, { x: 792, y: sideY, width: 384, height: 180, autoHeight: true, rotation: 0, style: { ...p.style, fontSize: 18 } });
    sideY += 204;
  }
  let bottom = Math.max(visualY, sideY);
  for (const p of texts.filter((p) => !sideText.includes(p))) {
    positions.set(p.id, { x: 24, y: bottom, width: 1152, height: 160, autoHeight: true, rotation: 0 });
    bottom += 184;
  }
  return { ...scene, primitives: scene.primitives.map((p) => positions.has(p.id) && !p.locked ? { ...p, ...positions.get(p.id) } as Primitive : p) };
}
