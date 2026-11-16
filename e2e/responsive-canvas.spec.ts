import { expect, test } from "@playwright/test";

for (const viewport of [{width:320,height:480},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1280,height:720},{width:1920,height:1080},{width:844,height:390}]) {
  test(`canvas controls remain usable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-light", "Viewport matrix runs once.");
    await page.setViewportSize(viewport);
    await page.goto("/#/lienzo");
    await expect(page.getByRole("button", { name: "Plantillas", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Plantillas", exact: true }).click();
    await page.getByRole("button", { name: /Sumar fracciones/ }).click();
    await expect(page.locator(".pc-board")).toBeVisible();
    const stage = page.locator(".pc-stage");
    expect((await stage.boundingBox())!.height).toBeGreaterThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const before = await stage.boundingBox();
    const assistant = page.getByRole("button", { name: "Asistente", exact: true });
    if (await assistant.getAttribute("aria-pressed") === "true") await assistant.click();
    await assistant.click();
    await expect(page.getByRole("complementary", { name: "Panel de Fontex" })).toBeVisible();
    if (viewport.width <= 1100) expect((await stage.boundingBox())!.width).toBe(before!.width);
    await page.getByRole("button", { name: "Cerrar panel", exact: true }).click();
    await expect(page.getByRole("complementary", { name: "Panel de Fontex" })).not.toBeVisible();
    await page.getByRole("button", { name: "Archivo", exact: true }).click();
    const title = page.getByRole("textbox", { name: "Título del lienzo" });
    await title.fill("Clase en pantalla adaptable");
    await title.press("Escape");
    await page.reload();
    await expect(page.getByRole("tab", { name: "Clase en pantalla adaptable" })).toBeVisible();
  });
}
