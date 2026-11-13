import type { ObjectType } from "../../core/document-schema/document";
export const moduleGroups = { all: "Todos", numbers: "Números", algebra: "Álgebra", geometry: "Geometría", data: "Datos y azar", text: "Texto" } as const;
export type ModuleGroup = keyof typeof moduleGroups;
export const moduleCatalog: Record<ObjectType, { group: Exclude<ModuleGroup, "all">; keywords: string }> = {
  fraction: { group: "numbers", keywords: "fracciones partes numerador denominador" }, operation: { group: "numbers", keywords: "suma resta multiplicación operaciones fracciones" },
  collection: { group: "numbers", keywords: "números enteros contar suma" }, "number-line": { group: "numbers", keywords: "rectas números negativos" }, factorization: { group: "numbers", keywords: "factorización primos descomposición" }, divisibility: { group: "numbers", keywords: "divisibilidad múltiplos divisores" }, "powers-roots": { group: "numbers", keywords: "potencia raíz exponentes" }, percentage: { group: "numbers", keywords: "porcentaje razón proporción descuento" },
  sequence: { group: "algebra", keywords: "sucesiones patrones progresiones" }, "linear-equation": { group: "algebra", keywords: "ecuaciones incógnita igualdad" }, "algebra-tiles": { group: "algebra", keywords: "álgebra ecuaciones piezas" },
  geometry: { group: "geometry", keywords: "geometría área triángulo rectángulo" }, polygon: { group: "geometry", keywords: "polígono perímetro vértices" }, angle: { group: "geometry", keywords: "ángulo grados transportador" }, circle: { group: "geometry", keywords: "círculo circunferencia radio" }, measurement: { group: "geometry", keywords: "medida conversión unidades longitud" },
  statistics: { group: "data", keywords: "estadística media mediana moda datos" }, probability: { group: "data", keywords: "probabilidad moneda dado ruleta azar" }, text: { group: "text", keywords: "texto explicación pregunta título" },
};
export const normalizeModule = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
