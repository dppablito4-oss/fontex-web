import { expect, it } from "vitest";
import { newPrimitiveScene, createPrimitive } from "../../core/primitives/schema";
import { contextualTitle } from "./document-title";
it("names default canvases from the generated heading and preserves manual titles", () => {
  const scene = newPrimitiveScene("Lienzo 5"), text = createPrimitive("math_block", scene);
  text.data.markdownContent = "## Suma de fracciones\nTexto";
  scene.primitives.push(text);
  expect(contextualTitle(scene, "Haz una lección")).toBe("Suma de fracciones");
  expect(contextualTitle({ ...scene, title: "Mi clase del lunes" }, "Derivadas")).toBe("Mi clase del lunes");
});
