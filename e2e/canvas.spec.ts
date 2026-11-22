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
  await expect(page.locator(".pc-node-math_block .academic-markdown").first()).toBeVisible();
  const value = page.getByRole("textbox", { name: "Valor de a", exact: true });
  if (await value.count()) { await value.fill("6"); await value.press("Enter"); await expect(value).toHaveValue("6"); }
  await page.waitForTimeout(250); // The local snapshot is intentionally debounced 180 ms.
  await page.reload();
  await expect(page.locator(".pc-node-coordinate_canvas")).toHaveCount(1);
  await expect(page.locator(".pc-node-math_block")).toHaveCount(2);
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
  await page.mouse.move(stage.x + 5, stage.y + 100);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(stage.x + 5, stage.y + 20, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await expect.poll(() => page.locator(".pc-stage").evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Ajustar ancho" }).click();
  await expect.poll(() => page.locator(".pc-stage").evaluate(el => el.scrollTop)).toBe(0);
});

test("desktop zoom scales the entire lesson and wheel scrolling stays within its content", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "Mobile uses the reading layout and touch scrolling.");
  const scene = newPrimitiveScene("Recorrido visual");
  const intro = createPrimitive("math_block", scene);
  intro.y = 2400; intro.width = 1152; intro.data.markdownContent = "## Observa la figura\nIdentifica las partes antes de calcular.";
  scene.primitives.push(intro);
  const plot = createPrimitive("coordinate_canvas", scene);
  plot.y = 2680; plot.width = 1152; plot.height = 790; plot.presentationStep = 2;
  scene.primitives.push(plot);
  const vector = createPrimitive("vector_segment", scene);
  vector.data.canvasId = plot.id; vector.label = "Radio"; vector.data.showMagnitude = false;
  vector.presentationStep = 2; scene.primitives.push(vector);
  const end = createPrimitive("math_block", scene);
  end.y = 3500; end.width = 1152; end.presentationStep = 3; end.data.markdownContent = "## Interpreta el resultado";
  scene.primitives.push(end);
  await page.locator('input[type="file"]').setInputFiles({ name: "recorrido.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole("button", { name: "Cerrar panel", exact: true }).click();
  const stage = page.locator(".pc-stage"), board = page.locator(".pc-board");
  await expect.poll(async () => {
    const first = (await page.locator(".pc-node-math_block").first().boundingBox())!;
    return first.y - (await stage.boundingBox())!.y;
  }).toBeLessThan(48);
  expect((await page.getByRole("heading", { name: "Observa la figura" }).boundingBox())!.y - (await stage.boundingBox())!.y).toBeLessThan(70);
  const before = await board.evaluate(el => getComputedStyle(el).transform);
  await page.getByRole("button", { name: "Acercar", exact: true }).click();
  await expect(board).not.toHaveCSS("transform", before);
  await page.getByRole("button", { name: "Alejar", exact: true }).click();
  await expect(board).toHaveCSS("transform", before);
  const bounds = (await page.locator(".pc-plot-scale").textContent())!;
  await page.locator(".pc-coordinate > svg").scrollIntoViewIfNeeded();
  const box = (await page.locator(".pc-coordinate > svg").boundingBox())!;
  const stageBox = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, Math.max(stageBox.y+60, Math.min(box.y + box.height / 2, stageBox.y + stageBox.height-40)));
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -220);
  await page.keyboard.up("Control");
  await expect(board).not.toHaveCSS("transform", before);
  await expect(page.locator(".pc-plot-scale")).toHaveText(bounds);
  await page.mouse.wheel(0, 100000);
  await expect.poll(() => stage.evaluate(el => el.scrollHeight-el.clientHeight-el.scrollTop)).toBeLessThan(2);
  await expect(page.locator(".pc-node-math_block").last()).toBeInViewport();
  await page.mouse.wheel(0, -100000);
  await expect.poll(() => stage.evaluate(el => el.scrollTop)).toBe(0);
  await expect(page.locator(".pc-node-math_block").first()).toBeInViewport();
  const zoomed = await board.evaluate(el => getComputedStyle(el).transform);
  await stage.focus();
  await page.keyboard.press("Control+-");
  await expect(board).not.toHaveCSS("transform", zoomed);
});

test("chat keyboard sends on desktop Enter and retains Shift Enter and mobile newlines", async ({ page }, info) => {
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Asistente", exact: true }).click();
  const message = page.getByRole("textbox", { name: "Mensaje para Fontex AI" });
  await message.fill("Explica una idea");
  await message.press("Shift+Enter");
  await expect(message).toHaveValue("Explica una idea\n");
  await message.fill("Explica una idea");
  await message.press("Enter");
  if (info.project.name === "mobile") {
    await expect(message).toHaveValue("Explica una idea\n");
  } else {
    await expect(message).toHaveValue("Explica una idea");
    await expect(page.locator(".pc-banner")).toContainText("Inicia sesión");
  }
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

test("practices on a personal copy with only the requested values and an inline answer", async ({ page }) => {
  await page.getByRole("button",{name:"Plantillas",exact:true}).click();
  await page.getByRole("region",{name:"Plantillas",exact:true}).getByRole("button",{name:/Practicar: denominador de una fracción/}).click();
  const source=await page.getByRole("tab",{selected:true}).textContent();
  await page.getByRole("button",{name:"Practicar",exact:true}).click();
  await expect(page.getByRole("complementary",{name:"Panel de Fontex"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Cambiar Numerador",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Cambiar Denominador",exact:true}).click();
  const value=page.getByRole("spinbutton",{name:"Denominador",exact:true});
  // Inline numeric inputs retain a text keyboard contract and validate on confirmation.
  const input=await value.count() ? value : page.getByRole("textbox",{name:"Denominador",exact:true});
  await input.fill("0");await input.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await input.fill("2");await input.press("Enter");
  await expect(page.getByRole("button",{name:"Cambiar Denominador",exact:true})).toContainText("2");
  await page.getByRole("button",{name:"Cambiar Tu respuesta",exact:true}).click();
  await page.getByRole("textbox",{name:"Tu respuesta",exact:true}).fill("Elegí dos partes iguales: una de dos es la mitad.");
  await page.getByRole("button",{name:"Aplicar Tu respuesta",exact:true}).click();
  await expect(page.getByRole("button",{name:"Cambiar Tu respuesta",exact:true})).toContainText("mitad");
  await page.getByRole("button",{name:"Finalizar práctica",exact:true}).click();
  await page.getByRole("tab",{name:source!,exact:true}).click();
  await expect(page.locator(".pc-circles > strong")).toHaveText("1 / 4");
});

test("changes a requested table cell in place and handles a degree-mode practice curve", async ({ page }) => {
  await page.getByRole("button",{name:"Plantillas",exact:true}).click();
  await page.getByRole("region",{name:"Plantillas",exact:true}).getByRole("button",{name:/Practicar: completar una tabla/}).click();
  await page.getByRole("button",{name:"Practicar",exact:true}).click();
  const cell=page.locator(".pc-chart tbody tr").nth(1).locator("td").nth(1);
  await expect(cell).toBeVisible();
  await cell.getByRole("button").click();
  await cell.getByRole("textbox",{name:"Segundo: valor",exact:true}).fill("4");
  await cell.getByRole("button",{name:"Aplicar Segundo: valor",exact:true}).click();
  await expect(cell).toContainText("4");
  await expect(page.getByRole("button",{name:"Cambiar Primero: valor",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Finalizar práctica",exact:true}).click();
  await page.getByRole("button",{name:"Plantillas",exact:true}).click();
  await page.getByRole("region",{name:"Plantillas",exact:true}).getByRole("button",{name:/Practicar: grados y radianes/}).click();
  await page.getByRole("button",{name:"Practicar",exact:true}).click();
  await page.getByRole("button",{name:"Cambiar Valor de theta (°)",exact:true}).click();
  await page.getByRole("textbox",{name:"Valor de theta (°)",exact:true}).fill("30");
  await page.getByRole("button",{name:"Aplicar Valor de theta (°)",exact:true}).click();
  await expect(page.locator(".pc-error")).toHaveCount(0);
  await page.getByRole("button",{name:"Cambiar Tu respuesta",exact:true}).click();
  await page.getByRole("textbox",{name:"Tu respuesta",exact:true}).fill("pi/6");
  await page.getByRole("button",{name:"Aplicar Tu respuesta",exact:true}).click();
  await expect(page.getByRole("button",{name:"Cambiar Tu respuesta",exact:true})).toContainText("pi/6");
});

test("edits line parameters and a mathematical answer without changing the definition", async ({ page }) => {
  await page.getByRole("button",{name:"Plantillas",exact:true}).click();
  await page.getByRole("region",{name:"Plantillas",exact:true}).getByRole("button",{name:/Practicar: construir una recta/}).click();
  await page.getByRole("button",{name:"Practicar",exact:true}).click();
  for (const [name,value] of [["m","2"],["b","1"]]) {
    await page.getByRole("button",{name:`Cambiar Valor de ${name}`,exact:true}).click();
    await page.getByRole("textbox",{name:`Valor de ${name}`,exact:true}).fill(value);
    await page.getByRole("button",{name:`Aplicar Valor de ${name}`,exact:true}).click();
  }
  await page.getByRole("button",{name:"Cambiar Tu respuesta",exact:true}).click();
  await page.getByRole("textbox",{name:"Tu respuesta",exact:true}).fill("2*x+1");
  await page.getByRole("button",{name:"Aplicar Tu respuesta",exact:true}).click();
  await expect(page.locator(".pc-error")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Cambiar Función f(x)",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Cambiar Tu respuesta",exact:true})).toContainText("2*x+1");
});
