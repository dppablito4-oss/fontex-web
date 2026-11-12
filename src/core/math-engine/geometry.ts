export type GeometryData = { figure: "rectangle" | "triangle"; base: number; height: number };
export function geometryArea(data: GeometryData) {
  return { n: data.base * data.height, d: data.figure === "triangle" ? 2 : 1 };
}
