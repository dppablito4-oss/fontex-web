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
