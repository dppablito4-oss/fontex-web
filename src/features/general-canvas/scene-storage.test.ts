import { expect, it } from "vitest";
import { expressionScene } from "../../core/scene/document";
import { clearRetiredMaterials, sceneCacheKey } from "./scene-storage";

it("removes retired materials across accounts and preserves native scenes, sessions and preferences", () => {
  const scene = expressionScene("sin(x)");
  const retired = { ...scene, id: "import-test" };
  for (const owner of ["guest", "one", "two"]) {
    for (const prefix of ["studio-v1", "studio-v2", "studio-chat-v1", "studio-sync-v1", "general-prototype"]) {
      localStorage.setItem(`fontex-${prefix}:${owner}`, "test data");
    }
    localStorage.setItem(sceneCacheKey(owner), JSON.stringify({ activeId: retired.id, scenes: [retired, scene] }));
    localStorage.setItem(`${sceneCacheKey(owner)}:ack`, "{}");
  }
  localStorage.setItem("sb-project-auth-token", "session");
  localStorage.setItem("fontex-theme", "dark");
  clearRetiredMaterials(localStorage);
  clearRetiredMaterials(localStorage);
  for (const owner of ["guest", "one", "two"]) {
    expect(JSON.parse(localStorage.getItem(sceneCacheKey(owner))!)).toEqual({ activeId: scene.id, scenes: [scene] });
    expect(localStorage.getItem(`${sceneCacheKey(owner)}:ack`)).toBeNull();
    expect(localStorage.getItem(`fontex-studio-v2:${owner}`)).toBeNull();
  }
  expect(localStorage.getItem("sb-project-auth-token")).toBe("session");
  expect(localStorage.getItem("fontex-theme")).toBe("dark");
});
