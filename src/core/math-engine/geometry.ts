import type { LengthUnit } from "./regular-polygons.ts";
export type GeometryData = { figure: "rectangle" | "triangle"; base: number; height: number; unit?: LengthUnit };
export function geometryArea(data: GeometryData) {
  return { n: data.base * data.height, d: data.figure === "triangle" ? 2 : 1 };
}

export function geometryPerimeter(data: GeometryData) { return data.figure === "triangle" ? data.base + data.height + Math.hypot(data.base, data.height) : 2 * (data.base + data.height); }
