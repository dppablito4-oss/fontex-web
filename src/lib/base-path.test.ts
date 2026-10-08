import { describe, expect, it } from "vitest";

import { resolveBasePath } from "./base-path";

describe("resolveBasePath", () => {
  it("publica en la raíz por defecto para el dominio personalizado", () => {
    expect(resolveBasePath()).toBe("/");
    expect(resolveBasePath("/")).toBe("/");
  });

  it("normaliza el subdirectorio del dominio estándar de GitHub Pages", () => {
    expect(resolveBasePath("fontex-web")).toBe("/fontex-web/");
    expect(resolveBasePath("/fontex-web/")).toBe("/fontex-web/");
  });
});
