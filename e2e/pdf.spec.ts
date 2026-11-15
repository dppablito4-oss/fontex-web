import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createPrimitive, newPrimitiveScene } from "../src/core/primitives/schema";

test("exports readable light PDF callouts and formulas from every interface theme", async ({ page }) => {
  const scene = newPrimitiveScene("Sumamos números mixtos");
  for (const [index, variant] of (["callout_step", "callout_info", "card", "transparent"] as const).entries()) {
    const text = createPrimitive("math_block", scene);
    text.presentationStep = index + 1;
    text.data.variant = variant;
    text.data.markdownContent = String.raw`## Sumamos números mixtos
Ejemplo: $2\frac{1}{3}+1\frac{1}{6}$.

Sumamos los enteros y usamos partes del mismo tamaño:
$$\frac{2}{6}+\frac{1}{6}=\frac{3}{6}$$

> Conservamos los tres enteros y simplificamos la fracción.

Resultado: $3\frac{1}{2}$.`;
    scene.primitives.push(text);
  }
  for (const numerator of [2, 1, 3]) {
    const figure = createPrimitive("geometric_shape", scene);
    figure.data = { ...figure.data, shape: "circle_fraction", canvasId: null, divisions: 6, shadedExpr: String(numerator) };
    scene.primitives.push(figure);
  }

  await page.goto("/#/lienzo");
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.locator('input[type="file"]').setInputFiles({ name: "mixed-numbers.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF", exact: true }).click();
  const file = await download;
  await file.saveAs(test.info().outputPath("sumamos-numeros-mixtos.pdf"));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);

  // Inspect the actual images embedded in the downloaded PDF, not just the DOM.
  const task = getDocument({ data: new Uint8Array(await readFile(await file.path())), useSystemFonts: true });
  const pdf = await task.promise;
  let checked = 0;
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const pdfPage = await pdf.getPage(n);
      const operators = await pdfPage.getOperatorList();
      for (let i = 0; i < operators.fnArray.length; i++) {
        if (operators.fnArray[i] !== OPS.paintImageXObject) continue;
        const [id] = operators.argsArray[i] as [string];
        const objects = id.startsWith("g_") ? pdfPage.commonObjs : pdfPage.objs;
        const image = await new Promise<unknown>(resolve => { objects.get(id, resolve); });
        if (!image || typeof image !== "object" || !("width" in image) || !("height" in image) || !("data" in image)) continue;
        if (typeof image.width !== "number" || typeof image.height !== "number" || image.width < 900) continue;
        if (!(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)) continue;
        const channels = image.data.length / (image.width * image.height);
        expect([3, 4]).toContain(channels);
        let light = 0, dark = 0;
        for (let pixel = 0; pixel < image.data.length; pixel += channels) {
          const rgb = [image.data[pixel], image.data[pixel + 1], image.data[pixel + 2]];
          if (rgb.every(value => value > 220)) light++;
          if (rgb.every(value => value < 96)) dark++;
        }
        const pixels = image.width * image.height;
        expect(light / pixels, `light background in PDF image ${id}`).toBeGreaterThan(.85);
        expect(dark / pixels, `visible text in PDF image ${id}`).toBeGreaterThan(.001);
        expect(dark / pixels, `no dark theme panels in PDF image ${id}`).toBeLessThan(.08);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  } finally {
    await task.destroy();
  }
});
