import { expect, test } from "@playwright/test";
import { createPrimitive, newPrimitiveScene } from "../src/core/primitives/schema";

test("alternates explanations and their pictograms on canvas, after reopening, and in PDF", async ({ page }) => {
  const scene = newPrimitiveScene("Explicación y pictogramas por etapas");
  const texts = [
    ["Definición inicial", String.raw`## 1. Sumamos las partes\nLas fracciones cuentan partes del mismo tamaño: $\frac{2}{6}+\frac{1}{6}=\frac{3}{6}$.`],
    ["Primera conclusión", "## Así interpretamos el dibujo\nTres sextos son la mitad de la unidad. Primero observamos los modelos y después simplificamos."],
    ["Siguiente explicación", String.raw`## 2. Probamos otro ejemplo\nAhora reunimos cuartos: $\frac{1}{4}+\frac{1}{4}=\frac{2}{4}$.`],
    ["Conclusión final", "## Comprobamos el resultado\nDos cuartos son otra manera de representar media unidad."],
  ];
  // Legacy documents could save all text blocks before all their drawings.
  for (const [index, [label, markdown]] of texts.entries()) {
    const p = createPrimitive("math_block", scene);
    p.label = label; p.y = index * 180; p.data.markdownContent = markdown.replace(/\\n/g, "\n");
    scene.primitives.push(p);
  }
  for (const [denominator, nums] of [[6,[2,1,3]], [4,[1,1,2]]] as const) {
    for (const [index,numerator] of nums.entries()) {
      const p = createPrimitive("geometric_shape", scene);
      p.label = `Modelo ${denominator}-${index}`; p.y = 1000;
      p.data = { ...p.data, shape: "circle_fraction", canvasId: null, divisions: denominator, shadedExpr: String(numerator) };
      scene.primitives.push(p);
    }
  }
  await page.goto("/#/lienzo");
  await page.locator('input[type="file"]').setInputFiles({ name: "lesson.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(scene)) });
  const close = page.getByRole("button", { name: "Cerrar panel", exact: true });
  if (await close.count()) await close.click();
  await page.getByRole("button", { name: "Organizar lienzo", exact: true }).click();
  const ordered = () => page.locator(".pc-board .pc-object").evaluateAll(nodes => {
    const boxes = nodes.map(node => ({ name: node.getAttribute("aria-label"), box: node.getBoundingClientRect() }));
    const text = (name: string) => boxes.find(item => item.name === name)!.box;
    const row = (den: number) => boxes.filter(item => item.name?.startsWith(`Modelo ${den}-`)).map(item => item.box);
    return [
      text("Definición inicial").bottom <= Math.min(...row(6).map(b => b.top)) + 2,
      Math.max(...row(6).map(b => b.bottom)) <= text("Primera conclusión").top + 2,
      text("Primera conclusión").bottom <= text("Siguiente explicación").top + 2,
      text("Siguiente explicación").bottom <= Math.min(...row(4).map(b => b.top)) + 2,
      Math.max(...row(4).map(b => b.bottom)) <= text("Conclusión final").top + 2,
    ];
  });
  await expect.poll(ordered).toEqual([true,true,true,true,true]);
  await page.screenshot({ path: test.info().outputPath("secuencia-en-lienzo.png"), fullPage: true });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF", exact: true }).click();
  await (await download).saveAs(test.info().outputPath("secuencia-explicacion-modelo.pdf"));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".pc-node-math_block")).toHaveCount(4);
  await expect.poll(ordered).toEqual([true,true,true,true,true]);
});
