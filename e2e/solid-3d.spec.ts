import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  createPrimitive,
  newPrimitiveScene,
} from "../src/core/primitives/schema";

test("orbits real 3D solids with mouse/touch, links dimensions and persists the author's view", async ({ page, isMobile }) => {
  const scene = newPrimitiveScene("Cuerpos tridimensionales");
  scene.variables = [{
    name: "a",
    value: 2,
    min: 1,
    max: 4,
    step: .5,
    unit: "cm",
  }];
  const control = createPrimitive("control_slider", scene);
  scene.primitives.push(control);
  for (const solid of ["pyramid", "sphere", "cube"] as const) {
    const p = createPrimitive("solid_3d", scene);
    p.data.solid = solid;
    p.label = solid;
    p.data.widthExpr = p.data.radiusExpr = "a";
    scene.primitives.push(p);
  }
  let paidCalls = 0;
  await page.route("**/functions/v1/**", (route) => {
    paidCalls++;
    return route.abort();
  });
  await page.goto("/#/lienzo");
  await page.locator('input[type="file"]').setInputFiles({
    name: "Solidos.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(scene)),
  });
  const close = page.getByRole("button", { name: "Cerrar panel", exact: true });
  if (await close.count()) await close.click();
  const pyramid = page.getByRole("img", {
    name: "Pirámide en 3D",
    exact: true,
  });
  await pyramid.scrollIntoViewIfNeeded();
  const before = await pyramid.getAttribute("data-camera");
  const bounds = (await pyramid.boundingBox())!;
  const x = bounds.x + bounds.width * .4, y = bounds.y + bounds.height * .5;
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 5; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + i * 10, y: y + i * 3 }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 25, { steps: 5 });
    await page.mouse.up();
  }
  await expect(pyramid).not.toHaveAttribute("data-camera", before!);
  const authoredView = await pyramid.getAttribute("data-camera");
  const slider = page.getByRole("slider", { name: "Variable a", exact: true });
  await slider.fill("3");
  await slider.dispatchEvent("input");
  await slider.dispatchEvent("change");
  const cube = page.getByRole("article", { name: "cube", exact: true });
  await expect(cube).toContainText("Volumen: 27 cm³");
  await expect(page.locator(".pc-error")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("img", { name: "Pirámide en 3D", exact: true }))
    .toHaveAttribute("data-camera", authoredView!);
  expect(paidCalls).toBe(0);
  await page.screenshot({
    path: test.info().outputPath("solidos-3d.png"),
    fullPage: true,
  });
});

test("creates a sphere manually and exports its saved 3D view as a nonempty PDF image", async ({ page }) => {
  await page.goto("/#/lienzo");
  await page.getByRole("button", { name: "Elementos", exact: true }).click();
  await page.getByRole("region", { name: "Elementos", exact: true }).getByRole(
    "button",
    { name: "Cuerpo 3D", exact: true },
  ).click();
  await page.getByLabel("Cuerpo geométrico", { exact: true }).selectOption(
    "sphere",
  );
  await expect(page.getByRole("img", { name: "Esfera en 3D", exact: true }))
    .toBeVisible();
  const close = page.getByRole("button", { name: "Cerrar panel", exact: true });
  if (await close.count()) await close.click();
  await page.getByRole("button", { name: "Girar a la derecha", exact: true })
    .click();
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF", exact: true })
    .click();
  const file = await download;
  await file.saveAs(test.info().outputPath("esfera-3d.pdf"));
  const task = getDocument({
    data: new Uint8Array(await readFile(await file.path())),
    useSystemFonts: true,
  });
  const pdf = await task.promise;
  let colored = 0;
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n), ops = await p.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] !== OPS.paintImageXObject) continue;
        const [id] = ops.argsArray[i] as [string];
        const objects = id.startsWith("g_") ? p.commonObjs : p.objs;
        const raw = await new Promise<unknown>((resolve) => {
          objects.get(id, resolve);
        });
        if (
          !raw || typeof raw !== "object" || !("data" in raw) ||
          !("width" in raw) || !("height" in raw) ||
          typeof raw.width !== "number" || typeof raw.height !== "number" ||
          raw.width < 900 ||
          !(raw.data instanceof Uint8Array ||
            raw.data instanceof Uint8ClampedArray)
        ) continue;
        const channels = raw.data.length / (raw.width * raw.height);
        for (let k = 0; k < raw.data.length; k += channels) {
          if (
            raw.data[k + 1] > raw.data[k] + 10 &&
            raw.data[k + 1] > raw.data[k + 2] + 5
          ) colored++;
        }
      }
    }
    expect(colored).toBeGreaterThan(10000);
  } finally {
    await task.destroy();
  }
});
