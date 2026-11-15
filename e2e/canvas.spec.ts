import { readFile } from "node:fs/promises";
import { createPrimitive, newPrimitiveScene } from "../src/core/primitives/schema";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => { await page.goto("/#/lienzo"); });

test("full-width transparent plot, inline measurements and save/reopen", async ({ page }, info) => {
  await page.locator('.pc-empty button[data-module="green"]').last().click();
  if (await page.getByRole("button", { name: "Cerrar panel" }).count()) await page.getByRole("button", { name: "Cerrar panel" }).click();
  const plot = page.locator(".pc-node-coordinate_canvas");
  await expect(plot).toHaveCount(1);
  const stageBox = (await page.getByRole("main", { name: "Lienzo matemático" }).boundingBox())!;
  const box = (await plot.boundingBox())!;
  expect(box.width / stageBox.width).toBeGreaterThan(.85);
  expect(await plot.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await page.getByText("Definiciones y medidas", { exact: false }).click();
  await expect(page.locator(".pc-plot-definition-content .academic-markdown").first()).toBeVisible();
  const value = page.getByRole("textbox", { name: "Valor de a", exact: true });
  if (await value.count()) { await value.fill("6"); await value.press("Enter"); await expect(value).toHaveValue("6"); }
  await page.waitForTimeout(250); // The local snapshot is intentionally debounced 180 ms.
  await page.reload();
  await expect(page.locator(".pc-node-coordinate_canvas")).toHaveCount(1);
  await expect(page.locator(".pc-node-math_block")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath(`plot-${info.project.name}.png`), fullPage: true });
  if (info.project.name === "mobile") {
    await page.setViewportSize({width:320,height:740});
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("tabs retain the previous lesson and JSON round trip", async ({ page }) => {
  await page.getByRole("button", { name: "Derivada e integral" }).click();
  const first = await page.getByRole("tab", { selected: true }).textContent();
  await page.getByRole("button", { name: "Nuevo lienzo", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(page.locator(".pc-node-coordinate_canvas")).toHaveCount(0);
  await page.getByRole("tab", { name: first! }).click();
  await expect(page.locator(".pc-node-coordinate_canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Archivo", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar JSON", exact: true }).click();
  const saved = await download;
  const path = await saved.path();
  await page.getByRole("button", { name: "Nuevo lienzo", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.locator(".pc-node-coordinate_canvas")).toHaveCount(1);
});

test("right drag moves the plot and workspace independently", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "Mouse panning is a desktop gesture; mobile retains touch scrolling and plot controls.");
  await page.getByRole("button", { name: "Derivada e integral" }).click();
  await page.getByRole("button", { name: "Cerrar panel" }).click();
  const plot = page.locator(".pc-coordinate > svg");
  const before = await page.locator(".pc-plot-scale").textContent();
  const pointBefore = await plot.locator('path[stroke="currentColor"]').first().getAttribute("d");
  const box = (await plot.boundingBox())!;
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .5);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .55, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".pc-plot-scale")).not.toHaveText(before!);
  expect(await plot.locator('path[stroke="currentColor"]').first().getAttribute("d")).not.toBe(pointBefore);
  const stage = (await page.locator(".pc-stage").boundingBox())!;
  await page.mouse.move(stage.x + 5, stage.y + 10);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(stage.x + 85, stage.y + 70, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".pc-board-space")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 80, 60)");
  await page.getByRole("button", { name: "Ajustar ancho" }).click();
  await expect(page.locator(".pc-board-space")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
});

test("keyboard adjusts chat width and canvas focus restores", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "The mobile dock is an overlay.");
  const handle = page.getByRole("separator", { name: "Ancho del panel" });
  await handle.focus();
  const initial = Number(await handle.getAttribute("aria-valuenow"));
  await handle.press("ArrowLeft");
  await expect(handle).toHaveAttribute("aria-valuenow", String(initial + 20));
  await page.getByRole("button", { name: "Ampliar lienzo", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Panel de Fontex" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Panel de Fontex" })).toBeVisible();
});

test("text edits stay in Properties with live KaTeX and mobile outside dismissal", async ({ page }, info) => {
  await page.getByRole("button", { name: "Elementos", exact: true }).click();
  await page.getByRole("region", { name: "Elementos", exact: true }).getByRole("button", { name: "Texto y fórmula", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Texto y fórmula", exact: true });
  await editor.fill("Fracción: $\\frac{2}{5}$");
  await expect(page.locator(".pc-node-math_block .katex")).toHaveCount(1);
  await expect(page.locator(".pc-node-math_block textarea")).toHaveCount(0);
  await expect(page.getByLabel("Vista previa del texto").locator(".katex")).toHaveCount(1);
  if (info.project.name === "mobile") {
    const outside = page.getByRole("button", { name: "Cerrar panel y volver al lienzo" });
    await outside.click({ position: { x: 5, y: 40 } });
    await expect(editor).toHaveCount(0);
    await page.locator(".pc-node-math_block").click();
    await expect(editor).toHaveValue("Fracción: $\\frac{2}{5}$");
    await outside.click({ position: { x: 5, y: 40 } });
    await page.getByRole("button", { name: "Asistente", exact: true }).click();
    await page.getByRole("textbox", { name: "Mensaje para Fontex AI" }).fill("Mi borrador");
    await outside.click({ position: { x: 5, y: 40 } });
    await page.getByRole("button", { name: "Asistente", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Mensaje para Fontex AI" })).toHaveValue("Mi borrador");
  }
});

test("closes, cancels, reopens saved canvases and downloads a PDF without print", async ({ page }) => {
  await page.getByRole("button", { name: "Derivada e integral" }).click();
  if(await page.getByRole("button", { name: "Cerrar panel", exact: true }).count()) await page.getByRole("button", { name: "Cerrar panel", exact: true }).click();
  const title = await page.getByRole("tab", { selected: true }).textContent();
  await page.getByRole("button", { name: `Cerrar ${title}`, exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("tab", { name: title!, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Cerrar ${title}`, exact: true }).click();
  await page.getByRole("button", { name: "Guardar y cerrar", exact: true }).click();
  await expect(page.getByRole("tab", { name: title!, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Archivo", exact: true }).click();
  await page.getByText("Abrir mis lienzos", { exact: true }).click();
  await page.getByRole("button", { name: title!, exact: true }).click();
  await expect(page.getByRole("tab", { name: title!, exact: true })).toBeVisible();
  await page.evaluate(() => { window.print = () => { throw Error("Print must not be used"); }; });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  await file.saveAs(test.info().outputPath("fontex.pdf"));
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("keeps each fraction explanation with a compact horizontal sum in the canvas and PDF", async ({ page }, info) => {
  const scene = newPrimitiveScene("Suma de fracciones");
  for (const step of [1,2]) {
    const text = createPrimitive("math_block", scene);
    text.presentationStep = step; text.y = 1600+step*200;
    text.data.markdownContent = String.raw`## Paso ${step}: sumar partes iguales
Sumamos los numeradores y conservamos el denominador.

$$\frac{2}{7}+\frac{3}{7}=\frac{5}{7}$$`;
    scene.primitives.push(text);
    for (const numerator of [2,3,5]) {
      const p = createPrimitive("geometric_shape",scene);
      p.presentationStep = step; p.y = scene.primitives.length*400;
      p.data = { ...p.data, shape:"circle_fraction", canvasId:null, divisions:7, shadedExpr:String(numerator) };
      scene.primitives.push(p);
    }
  }
  await page.locator('input[type="file"]').setInputFiles({ name:"sum.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(scene)) });
  if(info.project.name === "mobile") {
    const rows = page.getByRole("group",{name:"Operación de fracciones"});
    await expect(rows).toHaveCount(2);
    const boxes = await rows.first().locator(".pc-fraction-term").evaluateAll(terms => terms.map(p => { const r=p.getBoundingClientRect(); return {y:r.y,left:r.left,right:r.right}; }));
    expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(8);
    expect(boxes[0].right).toBeLessThan(boxes[1].left);
    expect(boxes[1].right).toBeLessThan(boxes[2].left);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
  } else {
    await page.getByRole("button",{name:"Organizar lienzo",exact:true}).click();
    const boxes = await page.locator(".pc-node-geometric_shape").evaluateAll(figures => figures.slice(0,3).map(p=>{const r=p.getBoundingClientRect();return {y:r.y};}));
    expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(8);
  }
  await page.getByRole("button",{name:"PDF",exact:true}).click();
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Descargar PDF",exact:true}).click();
  const pdf=await download;
  const bytes=await readFile(await pdf.path());
  expect(bytes.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
});
