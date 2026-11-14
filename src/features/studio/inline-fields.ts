import { lengthUnits } from "../../core/math-engine/regular-polygons";
import { validateObject, type MathObject, type ObjectType } from "../../core/document-schema/document";
import { parseStudioOperation } from "../../core/math-engine/studio-operations";
import { unitDefinitions, type Unit } from "../../core/math-engine/learning-types";
import { superscriptPowers } from "../../core/math-engine/math-notation";
import { isPolynomialEquation, polynomialCoefficients, polynomialSource } from "../../core/math-engine/polynomial-editor";

type Field = { label: string; kind?: "text" | "multiline" | "list" | "vertices" | "decimal" | "real" | "real-list"; hint?: string; choices?: Record<string, string> };
const lengthUnit: Field = { label: "Unidad de medida", choices: lengthUnits };
const shape = { label: "Representación", choices: { bar: "Barras", circle: "Círculos" } };
const coefficient = (letter: string): Field => ({ label: `Coeficiente ${letter}`, hint: "Entero de −1000 a 1000." });
// Every module, including future ones, must declare the editing contract for its inputs.
type Contracts = { [T in ObjectType]: Record<Exclude<keyof Extract<MathObject, { type: T }>["data"], "stage">, Field> };
export const inlineFields = {
  "function-graph": {
    source: { label: "Función de x", kind: "text", hint: "Ejemplos: sin(x), cos(x), tan(x), a*x²+b*x+c. Hasta 500 caracteres." },
    angleUnit: { label: "Unidad angular", choices: { degrees: "Grados (°)", radians: "Radianes (rad)" } },
    xMin: { label: "Mínimo de x", kind: "real" }, xMax: { label: "Máximo de x", kind: "real" },
    yMin: { label: "Mínimo de y", kind: "real" }, yMax: { label: "Máximo de y", kind: "real" },
    a: { label: "Parámetro a", kind: "real", hint: "Número de −5 a 5." }, b: { label: "Parámetro b", kind: "real", hint: "Número de −5 a 5." }, c: { label: "Parámetro c", kind: "real", hint: "Número de −5 a 5." },
    pointXs: { label: "Puntos de x", kind: "real-list", hint: "Hasta 24 valores separados por comas; decimales con punto. El motor calcula sus alturas." },
    showDerivative: { label: "Mostrar derivada", choices: { false: "Ocultar derivada", true: "Mostrar derivada" } },
  },
  "regular-polygon": { sides: { label: "Número de lados", hint: "Entero de 3 a 12; todos los lados y ángulos son iguales." }, sideLength: { label: "Longitud del lado", kind: "decimal", hint: "De 0,01 a 1000, hasta dos decimales." }, unit: { label: "Unidad de medida", choices: { u: "u", mm: "mm", cm: "cm", m: "m", km: "km" } } },
  fraction: { numerator: { label: "Numerador", hint: "Entero de 0 a 72, hasta tres unidades." }, denominator: { label: "Denominador", hint: "Entero de 1 a 24; hasta tres unidades." }, shape },
  operation: { expression: { label: "Operación", kind: "text", hint: "Ejemplo: 2/3 + 1/6. También resta y multiplicación." }, shape },
  text: { content: { label: "Contenido", kind: "multiline", hint: "Hasta 5000 caracteres." }, fontSize: { label: "Tamaño del texto", hint: "Entero de 14 a 48." } },
  sequence: { start: { label: "Primer término", hint: "Entero de −1000 a 1000." }, difference: { label: "Diferencia entre términos", hint: "Entero de −100 a 100." }, count: { label: "Cantidad de términos", hint: "De 2 a 8 términos." } },
  collection: { values: { label: "Enteros de la colección", kind: "list", hint: "De 1 a 24 enteros entre −1000 y 1000, separados por comas." } },
  "number-line": { min: { label: "Mínimo de la recta", hint: "Entero entre −100 y 100, menor que el máximo. Los puntos deben quedar dentro del intervalo." }, max: { label: "Máximo de la recta", hint: "Entero entre −100 y 100, mayor que el mínimo. Los puntos deben quedar dentro del intervalo." }, step: { label: "Tamaño del paso", hint: "Paso entero de 1 a 50 que divida el intervalo; máximo 40 marcas." }, points: { label: "Puntos enteros", kind: "list", hint: "Hasta 12 puntos distintos dentro de la recta, separados por comas." } },
  "linear-equation": { a: coefficient("a"), b: coefficient("b"), c: coefficient("c"), d: coefficient("d") },
  geometry: { unit: lengthUnit, base: { label: "Base", hint: "Entero de 1 a 100." }, height: { label: "Altura", hint: "Entero de 1 a 100." }, figure: { label: "Figura", choices: { rectangle: "Rectángulo", triangle: "Triángulo rectángulo" } } },
  polygon: { unit: lengthUnit, vertices: { label: "Vértices", kind: "vertices", hint: "De 3 a 8 puntos x,y separados por ;. Coordenadas enteras de 0 a 20, sin cruces." } },
  factorization: { number: { label: "Número a factorizar", hint: "Entero de 2 a 360." } },
  percentage: { part: { label: "Parte" }, whole: { label: "Todo", hint: "Entero de 1 a 100. La parte no supera el todo salvo en razones." }, quantity: { label: "Cantidad total", hint: "Entero de 0 a 10000." }, task: { label: "Tipo de porcentaje", choices: { portion: "Parte de una cantidad", discount: "Descuento", ratio: "Razón" } } },
  divisibility: { a: { label: "Primer número", hint: "Entero de 2 a 360." }, b: { label: "Segundo número", hint: "Entero de 2 a 360." }, task: { label: "Buscar", choices: { gcd: "MCD", lcm: "MCM" } } },
  angle: { degrees: { label: "Grados", hint: "Entero de 0 a 360." } },
  circle: { unit: lengthUnit, radius: { label: "Radio", hint: "Entero de 1 a 100." }, task: { label: "Calcular", choices: { area: "Área", circumference: "Longitud de la circunferencia" } } },
  statistics: { values: { label: "Datos estadísticos", kind: "list", hint: "De 1 a 24 enteros de 0 a 100, separados por comas." }, task: { label: "Medida estadística", choices: { mean: "Media", median: "Mediana", mode: "Moda" } } },
  probability: { experiment: { label: "Experimento", choices: { coin: "Moneda", dice: "Dado", spinner: "Ruleta" } }, outcomes: { label: "Resultados posibles", hint: "Ruleta: de 2 a 12 sectores iguales." }, favorable: { label: "Resultados favorables", hint: "Entre 0 y el número de resultados posibles." }, trials: { label: "Ensayos", hint: "Entero de 10 a 200." }, seed: { label: "Serie de simulación", hint: "Entero de 1 a 2147483646." } },
  "algebra-tiles": { a: coefficient("a"), b: coefficient("b"), c: coefficient("c"), d: coefficient("d") },
  "powers-roots": { base: { label: "Base", hint: "Entero de 0 a 12." }, exponent: { label: "Exponente o índice", hint: "Potencias: de 1 a 3. Raíces: 2 o 3." }, task: { label: "Operación de potencia", choices: { power: "Potencia", root: "Raíz exacta" } } },
  measurement: { value: { label: "Cantidad inicial", hint: "Entero de 0 a 10000." }, from: { label: "Unidad inicial", choices: Object.fromEntries(Object.entries(unitDefinitions).map(([key, unit]) => [key, unit.label])) }, to: { label: "Unidad final", choices: Object.fromEntries(Object.entries(unitDefinitions).map(([key, unit]) => [key, unit.label])) } },
} satisfies Contracts;

export function fieldSpec(object: MathObject, field: string): Field {
  if (object.type === "function-graph" && /^coefficient:[0-8]$/.test(field)) return { label: `Coeficiente ${String.fromCharCode(65 + Number(field.split(":")[1]))}`, kind: "real", hint: "Número real finito; la curva y las soluciones se actualizan al editar." };
  if (field === "label") return { label: "Nombre del objeto", kind: "text", hint: "Hasta 120 caracteres." };
  if (field === "radicand") return { label: "Radicando", hint: "Raíz exacta cuadrada o cúbica con resultado entero de 0 a 12." };
  const spec = (inlineFields[object.type] as Record<string, Field>)[field];
  if (!spec) throw new Error(`Falta el editor de ${object.type}.${field}`);
  if (object.type === "algebra-tiles") return { ...spec, hint: field === "a" || field === "c" ? "De 0 a 8 piezas x por lado." : "Constante entera de −20 a 20." };
  return spec;
}
export function fieldValue(object: MathObject, field: string): unknown {
  if (object.type === "function-graph" && field.startsWith("coefficient:")) {
    const values = polynomialCoefficients(object.data.source, object.data) ?? [];
    while (values.length < 3) values.push(0);
    return values.reverse()[Number(field.split(":")[1])];
  }
  if (field === "label") return object.label;
  if (field === "unit" && ["geometry", "polygon", "circle"].includes(object.type)) return (object.data as { unit?: string }).unit ?? "u";
  if (field === "radicand" && object.type === "powers-roots") return object.data.base ** object.data.exponent;
  return (object.data as unknown as Record<string, unknown>)[field];
}
export function formatField(value: unknown, kind?: Field["kind"]): string {
  if (kind === "vertices") return (value as { x: number; y: number }[]).map(p => `${p.x},${p.y}`).join("; ");
  if (Array.isArray(value)) return (value as number[]).join(", ");
  return typeof value === "string" ? superscriptPowers(value) : String(value);
}
const integer = (raw: string) => {
  if (!/^[+-]?\d+$/.test(raw.trim())) throw new Error("Escribe un número entero.");
  return Number(raw);
};
const real = (raw: string) => { const value = Number(raw.trim().replace(",", ".")); if (!raw.trim() || !Number.isFinite(value)) throw new Error("Escribe un número real finito."); return value; };
export function editField(object: MathObject, field: string, raw: string, index?: number): MathObject {
  const spec = fieldSpec(object, field);
  let value: unknown = raw;
  if (index !== undefined) {
    const values = [...fieldValue(object, field) as number[]];
    values[index] = spec.kind === "real-list" ? real(raw) : integer(raw);
    value = values;
  } else if (spec.kind === "vertices") {
    value = raw.split(";").map(pair => {
      const parts = pair.split(",");
      if (parts.length !== 2) throw new Error(spec.hint);
      return { x: integer(parts[0]!), y: integer(parts[1]!) };
    });
  } else if (spec.kind === "decimal") {
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim())) throw new Error(spec.hint);
    value = Number(raw.trim().replace(",", "."));
  } else if (spec.kind === "real") value = real(raw);
  else if (spec.kind === "real-list") value = raw.trim() ? raw.split(",").map(real) : [];
  else if (spec.kind === "list") value = raw.trim() ? raw.split(",").map(integer) : [];
  else if (!spec.kind && !spec.choices) value = integer(raw);
  if (object.type === "function-graph" && field === "showDerivative") { if (raw !== "true" && raw !== "false") throw new Error("Elige mostrar u ocultar la derivada."); value = raw === "true"; }
  let next: unknown = field === "label" ? { ...object, label: value } : { ...object, data: { ...object.data, [field]: value } };
  if (object.type === "function-graph" && field.startsWith("coefficient:")) {
    const values = polynomialCoefficients(object.data.source, object.data);
    if (!values) throw new Error("La expresión no es un polinomio editable por coeficientes.");
    while (values.length < 3) values.push(0);
    values.reverse()[Number(field.split(":")[1])] = value as number;
    next = { ...object, data: { ...object.data, source: polynomialSource(values, isPolynomialEquation(object.data.source)) } };
  }
  if (object.type === "operation" && field === "expression") parseStudioOperation(raw);
  if (object.type === "probability") {
    const data = { ...object.data, [field]: value };
    if (field === "experiment") data.outcomes = value === "coin" ? 2 : value === "dice" ? 6 : data.outcomes;
    if (field === "outcomes" || field === "experiment") data.favorable = Math.min(data.favorable, data.outcomes);
    next = { ...object, data };
  }
  if (object.type === "powers-roots") {
    const data = { ...object.data, [field]: value };
    if (field === "radicand") {
      const root = Math.round(Number(value) ** (1 / data.exponent));
      if (root ** data.exponent !== value) throw new Error(spec.hint);
      next = { ...object, data: { ...object.data, base: root } };
    } else {
      if (field === "task" && value === "root") data.exponent = Math.max(2, data.exponent);
      next = { ...object, data };
    }
  }
  if (object.type === "measurement" && (field === "from" || field === "to")) {
    const unit = value as Unit, other = field === "from" ? "to" : "from";
    const target = unitDefinitions[unit];
    if (target) next = { ...object, data: { ...object.data, [field]: unit, [other]: target.family === unitDefinitions[object.data[other]].family ? object.data[other] : unit } };
  }
  if (!validateObject(next)) throw new Error(`Revisa los valores. ${spec.hint ?? "El cambio debe respetar los límites del módulo."}`);
  return next;
}
