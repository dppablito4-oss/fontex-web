export const lengthUnits = { u: "u", mm: "mm", cm: "cm", m: "m", km: "km" } as const;
export type LengthUnit = keyof typeof lengthUnits;
export const validLengthUnit = (unit: unknown): unit is LengthUnit => typeof unit === "string" && Object.hasOwn(lengthUnits, unit);
export const unitOf = (data: { unit?: LengthUnit }) => data.unit ?? "u";
export type RegularPolygonData = { sides: number; sideLength: number; unit: LengthUnit };
const names = ["", "", "", "Triángulo equilátero", "Cuadrado", "Pentágono regular", "Hexágono regular", "Heptágono regular", "Octágono regular", "Eneágono regular", "Decágono regular", "Endecágono regular", "Dodecágono regular"];
export function regularPolygonInfo(data: RegularPolygonData) {
  const { sides, sideLength, unit } = data;
  if (!Number.isInteger(sides) || sides < 3 || sides > 12 || !Number.isFinite(sideLength) || sideLength < .01 || sideLength > 1000 || Math.abs(sideLength * 100 - Math.round(sideLength * 100)) > 1e-7 || !validLengthUnit(unit)) throw new Error("Usa de 3 a 12 lados iguales, longitud de 0,01 a 1000 con hasta dos decimales y una unidad de longitud.");
  const apothem = sideLength / (2 * Math.tan(Math.PI / sides));
  return { name: names[sides]!, perimeter: Math.round(sideLength * 100) * sides / 100, area: sides === 4 ? sideLength ** 2 : sides * sideLength * apothem / 2, areaExact: sides === 4, apothem, radius: sideLength / (2 * Math.sin(Math.PI / sides)) };
}
export const measureText = (value: number, exact = false) => Number(value.toFixed(exact ? 4 : 3)).toLocaleString("es-PE", { maximumFractionDigits: exact ? 4 : 3 });
