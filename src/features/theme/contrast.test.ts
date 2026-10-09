import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  resolve(process.cwd(), "src/styles/globals.css"),
  "utf8",
);

type Palette = Record<string, string>;

function readPalette(selector: string): Palette {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
  if (!block) throw new Error(`No se encontró la paleta ${selector}.`);

  const palette: Palette = {};
  for (const match of block.matchAll(/--ui-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, token, value] = match;
    if (token && value) palette[token] = value;
  }
  return palette;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const [red = 0, green = 0, blue = 0] = linear;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(first: string, second: string) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function paletteValue(palette: Palette, token: string) {
  const value = palette[token];
  if (!value) throw new Error(`Falta el token de color --ui-${token}.`);
  return value;
}

const textPairs = [
  ["foreground", "background"],
  ["muted-foreground", "background"],
  ["foreground", "surface"],
  ["primary-foreground", "primary"],
  ["accent-foreground", "accent"],
  ["success", "success-surface"],
  ["warning", "warning-surface"],
  ["error", "error-surface"],
  ["info-foreground", "info-surface"],
  ["on-brand", "brand-deep"],
  ["on-brand-muted", "brand-deep"],
] as const;

describe.each([
  ["light", readPalette(":root")],
  ["dark", readPalette(':root[data-theme="dark"]')],
])("%s theme contrast", (_theme, palette) => {
  it.each(textPairs)("keeps %s readable over %s", (foreground, background) => {
    expect(contrast(paletteValue(palette, foreground), paletteValue(palette, background))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps control borders and focus indicators distinguishable", () => {
    expect(contrast(paletteValue(palette, "control-border"), paletteValue(palette, "background"))).toBeGreaterThanOrEqual(3);
    expect(contrast(paletteValue(palette, "focus"), paletteValue(palette, "background"))).toBeGreaterThanOrEqual(3);
  });
});
