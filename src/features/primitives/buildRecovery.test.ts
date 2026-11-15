import { expect, it } from "vitest";
import { createPrimitive, newPrimitiveScene } from "../../core/primitives/schema";
import { recoveredScene, type BuildReceipt } from "./buildRecovery";
import { plotCompanions, organizePrimitiveScene, workspaceRoots } from "../../core/primitives/layout";
import { templateScene } from "../../core/primitives/templates";
function receipt(): BuildReceipt {
  const source = newPrimitiveScene();
  return { id: "fc010000-0000-4000-8000-000000000001", source, question: "Construye una fracción", state: "ready", created_at: new Date().toISOString(), applied_at: null,
    reply: { message: "Una fracción visual.", actions: [{ kind: "add_primitive", primitive: createPrimitive("stamp_grid",source) }] } };
}
it("recovers a completed proposal once even after an acknowledgement is lost", () => {
  const item = receipt();
  const result = recoveredScene(item.source,item);
  expect(result.primitives).toHaveLength(1);
  expect(result.appliedBuildIds).toEqual([item.id]);
  expect(result.conversation).toHaveLength(2);
  expect(recoveredScene(result,item)).toBe(result);
});
it("never overwrites edits made after starting a build and can recover into a separate document", () => {
  const item = receipt();
  const edited = { ...item.source, primitives: [createPrimitive("math_block",item.source)] };
  expect(() => recoveredScene(edited,item)).toThrow("El lienzo cambió");
  const separate = recoveredScene(edited,item,true);
  expect(separate.id).not.toBe(edited.id);
  expect(separate.primitives[0]!.kind).toBe("stamp_grid");
  expect(edited.primitives[0]!.kind).toBe("math_block");
});
it("deduplicates the saved user request and refuses an unfinished proposal", () => {
  const item = receipt();
  const current = { ...item.source, conversation: [{ role: "user" as const, content: item.question }] };
  expect(recoveredScene(current,item).conversation).toHaveLength(2);
  expect(() => recoveredScene(current,{ ...item,state:"pending",reply:null })).toThrow("todavía");
});
it("uses the full plot width and embeds definitions without deleting source objects", () => {
  const scene = templateScene("pythagoras");
  const plane = scene.primitives.find((p) => p.kind === "coordinate_canvas")!;
  expect(plane.width).toBe(1152);
  expect(workspaceRoots(scene)).toEqual([plane]);
  expect(plotCompanions(scene,plane.id).length).toBeGreaterThan(1);
  expect(organizePrimitiveScene(scene).primitives).toHaveLength(scene.primitives.length);
});
it("keeps independent lesson blocks available when more than one plot is present", () => {
  const scene = templateScene("pythagoras");
  scene.primitives.push(createPrimitive("coordinate_canvas",scene));
  expect(workspaceRoots(scene).some((p) => p.kind === "math_block")).toBe(true);
});
