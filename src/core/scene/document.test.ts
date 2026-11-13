import { expect, it } from "vitest";
import { expressionScene, MAX_SCENE_FILE_BYTES, parseScene, readSceneFile, serializeScene } from "./document";

it("round-trips long titles and a full conversation through the actual export/import format", () => {
  const scene = expressionScene("x^2");
  scene.title = "A".repeat(160);
  scene.conversation = Array.from({ length: 80 }, () => ({ role: "assistant" as const, content: "A".repeat(4000) }));
  const file = serializeScene(scene);
  expect(new TextEncoder().encode(file).byteLength).toBeGreaterThan(300000);
  expect(new TextEncoder().encode(file).byteLength).toBeLessThanOrEqual(MAX_SCENE_FILE_BYTES);
  expect(readSceneFile(file)).toEqual(scene);
  expect(() => parseScene({ ...scene, title: "A".repeat(161) })).toThrow();
});

it("bounds UTF-8 scene bytes so accepted scenes fit both exports and cloud storage", () => {
  const scene = expressionScene("x");
  scene.elements = Array.from({ length: 100 }, (_, i) => ({ id: String(i), kind: "text" as const, text: "界".repeat(5000) }));
  expect(() => parseScene(scene)).toThrow(/1 MiB/);
  expect(() => readSceneFile(" ".repeat(MAX_SCENE_FILE_BYTES + 1))).toThrow(/1 MiB/);
});

it("rejects retired imported identities and module elements", () => {
  const scene = expressionScene("x");
  expect(() => parseScene({ ...scene, id: "import-old" })).toThrow();
  expect(() => parseScene({ ...scene, elements: [{ id: "old", kind: "legacy", object: {} }] })).toThrow();
});
