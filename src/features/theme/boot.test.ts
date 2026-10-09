import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("theme bootstrap", () => {
  it("resolves the saved or system theme before loading the React entry point", () => {
    const index = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const bootstrapPosition = index.indexOf('localStorage.getItem("fontex-theme")');
    const entryPointPosition = index.indexOf('src="/src/main.tsx"');

    expect(bootstrapPosition).toBeGreaterThan(0);
    expect(entryPointPosition).toBeGreaterThan(bootstrapPosition);
    expect(index).toContain('document.documentElement.dataset.theme = theme');
  });
});
