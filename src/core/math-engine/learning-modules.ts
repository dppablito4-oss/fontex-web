import { commonDivisor, commonMultiple, medianValue, meanValue, circleArea, circleCircumference } from "../vendor/mathigon.ts";
import { analyzeFactors } from "./adapted-modules.ts";
import { solveLinearEquation, linearSide, equationResult } from "./equations.ts";
import { unitDefinitions, type LearningDataMap, type LearningPayload, type ExactAnswer, type Rational } from "./learning-types.ts";
export const rational = (n: number, d = 1): Rational => { const g = commonDivisor(n, d) || 1; return { n: n / g, d: d / g }; };
export const fractionText = (v: Rational) => v.d === 1 ? String(v.n) : `${v.n}/${v.d}`;
const int = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
const requireValid = (valid: boolean, message: string) => { if (!valid) throw new Error(message); };
export function percentageInfo(d: LearningDataMap["percentage"]) {
  requireValid(int(d.part, 0, 100) && int(d.whole, 1, 100) && (d.task === "ratio" || d.part <= d.whole) && int(d.quantity, 0, 10000) && ["portion", "discount", "ratio"].includes(d.task), "Usa partes enteras hasta 100 y cantidad de 0 a 10000. Para partes y descuentos, la parte no supera el total.");
  const portion = rational(d.part * d.quantity, d.whole), discount = rational((d.whole - d.part) * d.quantity, d.whole), percent = rational(100 * d.part, d.whole);
  return { portion, discount, percent, answer: d.task === "discount" ? discount : portion, decimal: d.part / d.whole, ratio: rational(d.part, d.whole) };
}
export function divisibilityInfo(d: LearningDataMap["divisibility"]) {
  requireValid(int(d.a, 2, 360) && int(d.b, 2, 360) && ["gcd", "lcm"].includes(d.task), "Los dos números deben estar entre 2 y 360.");
  const left = analyzeFactors(d.a).factors, right = analyzeFactors(d.b).factors;
  const primes = [...new Set([...left, ...right])].sort((a, b) => a - b);
  const common: number[] = [], combined: number[] = [];
  for (const p of primes) {
    const a = left.filter(x => x === p).length, b = right.filter(x => x === p).length;
    common.push(...Array<number>(Math.min(a, b)).fill(p)); combined.push(...Array<number>(Math.max(a, b)).fill(p));
  }
  const gcd = commonDivisor(d.a, d.b), lcm = commonMultiple(d.a, d.b);
  return { left, right, common, combined, gcd, lcm, answer: d.task === "gcd" ? gcd : lcm };
}
export function angleInfo(d: LearningDataMap["angle"]) {
  requireValid(int(d.degrees, 0, 360), "El ángulo debe medir de 0 a 360 grados enteros.");
  const degrees = d.degrees;
  return { degrees, classification: degrees === 0 ? "nulo" : degrees < 90 ? "agudo" : degrees === 90 ? "recto" : degrees < 180 ? "obtuso" : degrees === 180 ? "llano" : degrees < 360 ? "cóncavo" : "completo" };
}
export function circleInfo(d: LearningDataMap["circle"]) {
  requireValid(int(d.radius, 1, 100) && ["area", "circumference"].includes(d.task), "El radio debe ser entero de 1 a 100.");
  const coefficient = d.task === "area" ? d.radius ** 2 : 2 * d.radius;
  return { diameter: 2 * d.radius, coefficient, approximate: d.task === "area" ? circleArea(d.radius) : circleCircumference(d.radius), units: d.task === "area" ? "u²" : "u" };
}
export function statisticsInfo(d: LearningDataMap["statistics"]) {
  requireValid(Array.isArray(d.values) && d.values.length >= 1 && d.values.length <= 24 && d.values.every(n => int(n, 0, 100)) && ["mean", "median", "mode"].includes(d.task), "Usa de 1 a 24 datos enteros de 0 a 100.");
  const sorted = [...d.values].sort((a, b) => a - b), sum = sorted.reduce((a, b) => a + b, 0);
  const counts = [...new Set(sorted)].map(value => ({ value, count: sorted.filter(n => n === value).length }));
  const maximum = Math.max(...counts.map(c => c.count));
  const modes = maximum > 1 ? counts.filter(c => c.count === maximum).map(c => c.value) : [];
  const mean = rational(sum, sorted.length), median = rational(medianValue(sorted) * 2, 2);
  return { sorted, counts, sum, mean, meanApproximate: meanValue(sorted), median, modes };
}
export function probabilityInfo(d: LearningDataMap["probability"]) {
  requireValid(["coin", "dice", "spinner"].includes(d.experiment) && int(d.outcomes, 2, 12) && (d.experiment !== "coin" || d.outcomes === 2) && (d.experiment !== "dice" || d.outcomes === 6) && int(d.favorable, 0, d.outcomes) && int(d.trials, 10, 200) && int(d.seed, 1, 2147483646), "Moneda: 2 resultados; dado: 6; ruleta: 2–12 sectores iguales. De 10 a 200 ensayos.");
  let state = d.seed;
  const samples = Array.from({ length: d.trials }, () => { state = state * 48271 % 2147483647; return Math.floor(state / 2147483647 * d.outcomes) + 1; });
  const successes = samples.filter(n => n <= d.favorable).length;
  const counts = Array.from({ length: d.outcomes }, (_, i) => samples.filter(n => n === i + 1).length);
  return { theoretical: rational(d.favorable, d.outcomes), observed: rational(successes, d.trials), samples, counts, successes };
}
export function algebraTilesInfo(d: LearningDataMap["algebra-tiles"]) {
  requireValid(int(d.a, 0, 8) && int(d.c, 0, 8) && int(d.b, -20, 20) && int(d.d, -20, 20), "Hasta 8 piezas x por lado y constantes de −20 a 20.");
  return solveLinearEquation(d);
}
export function powersInfo(d: LearningDataMap["powers-roots"]) {
  requireValid(int(d.base, 0, 12) && int(d.exponent, 1, 3) && ["power", "root"].includes(d.task) && (d.task !== "root" || d.exponent >= 2), "Base entera de 0 a 12; potencias 1–3 y raíces exactas cuadradas o cúbicas.");
  const power = d.base ** d.exponent;
  return { power, answer: d.task === "root" ? d.base : power, factors: Array<number>(d.exponent).fill(d.base), rootSymbol: d.exponent === 2 ? "√" : "∛" };
}
export function measurementInfo(d: LearningDataMap["measurement"]) {
  requireValid(int(d.value, 0, 10000) && Object.hasOwn(unitDefinitions, d.from) && Object.hasOwn(unitDefinitions, d.to), "Cantidad entera de 0 a 10000 y unidades admitidas.");
  const from = unitDefinitions[d.from], to = unitDefinitions[d.to];
  requireValid(from.family === to.family, "Solo se convierten unidades de la misma magnitud: longitud, área, capacidad o tiempo.");
  return { from, to, factor: rational(from.scale, to.scale), answer: rational(d.value * from.scale, to.scale) };
}
export type LearningLesson = { answer: ExactAnswer; result: string; prompt: string; strategy: string; steps: [string, string][]; facts: unknown };
export function learningLesson(object: LearningPayload, level: string = "primary"): LearningLesson {
  const simple = level === "primary" || level === "initial";
  switch (object.type) {
    case "percentage": {
      const d = object.data, a = percentageInfo(d);
      return { answer: a.answer, result: fractionText(a.answer), prompt: d.task === "discount" ? `¿Cuánto queda de ${d.quantity} tras descontar ${fractionText(a.percent)} %?` : `Si corresponden ${d.part} de cada ${d.whole}, ¿cuánto corresponde a ${d.quantity}?`, strategy: "Divide la cantidad entre las partes del total y multiplica por las partes elegidas. Para un descuento resta esa parte de la cantidad inicial.", facts: a,
        steps: [["Relaciona parte y total", `Elegimos ${d.part} de ${d.whole} partes iguales. Razón: ${fractionText(a.ratio)}.`], ["Conecta fracción, decimal y porcentaje", `${d.part}/${d.whole} = ${a.decimal.toFixed(4)} aproximadamente; porcentaje exacto: ${fractionText(a.percent)} %. El dibujo colorea esa proporción de la unidad.`], ["Calcula la parte", `${d.quantity} × ${d.part}/${d.whole} = ${fractionText(a.portion)}. ${simple ? "Repartimos primero en partes iguales y tomamos las elegidas." : "El factor de proporcionalidad conserva la razón parte/total."}`], ["Comprueba el contexto", d.task === "discount" ? `${d.quantity} − ${fractionText(a.portion)} = ${fractionText(a.discount)}. Esta es la cantidad que queda, no el descuento.` : `Resultado: ${fractionText(a.portion)}. La razón es la misma aunque cambie la cantidad total.`]] };
    }
    case "divisibility": {
      const d = object.data, a = divisibilityInfo(d);
      return { answer: { n: a.answer, d: 1 }, result: String(a.answer), prompt: `Calcula el ${d.task === "gcd" ? "MCD" : "MCM"} de ${d.a} y ${d.b}.`, strategy: d.task === "gcd" ? "Selecciona los factores primos comunes con la menor cantidad de repeticiones." : "Selecciona todos los primos necesarios con la mayor cantidad de repeticiones.", facts: a,
        steps: [["Descompón los números", `${d.a} = ${a.left.join(" × ")}; ${d.b} = ${a.right.join(" × ")}. Todos los factores son primos.`], ["Busca lo común", `Factores compartidos: ${a.common.join(" × ") || "ninguno"}. MCD = ${a.gcd}; si no comparten factores, el MCD es 1.`], ["Completa todos los factores", `Para el MCM usamos ${a.combined.join(" × ")}. MCM = ${a.lcm}. Debe ser múltiplo de ambos números.`], ["Comprueba", `${d.a} ÷ ${a.gcd} = ${d.a / a.gcd}; ${d.b} ÷ ${a.gcd} = ${d.b / a.gcd}. ${a.lcm} ÷ ${d.a} = ${a.lcm / d.a}; ${a.lcm} ÷ ${d.b} = ${a.lcm / d.b}. Las cuatro divisiones son exactas.`]] };
    }
    case "angle": {
      const d = object.data, a = angleInfo(d);
      return { answer: { n: d.degrees, d: 1 }, result: String(d.degrees), prompt: "Mide el giro señalado en grados, siguiendo el arco desde el rayo inicial.", strategy: "Comienza en 0° sobre el rayo horizontal y sigue las marcas del transportador en el sentido del arco.", facts: a,
        steps: [["Reconoce el vértice y los rayos", "Los dos rayos parten del mismo punto. La abertura mide un giro, no el largo de las líneas."], ["Lee la escala", `Una vuelta completa tiene 360°. El arco señalado recorre ${d.degrees}° en sentido antihorario.`], ["Clasifica", `Es un ángulo ${a.classification}. Referencias: 90° recto, 180° llano y 360° completo.`], ["Comprueba", `Compara ${d.degrees}° con un cuarto, media y una vuelta completa. El ángulo de 0° no recorre un giro; el de 360° completa toda la vuelta.`]] };
    }
    case "circle": {
      const d = object.data, a = circleInfo(d);
      return { answer: { pi: a.coefficient }, result: `${a.coefficient}π`, prompt: `Calcula ${d.task === "area" ? "el área" : "la longitud de la circunferencia"} de radio ${d.radius}. Responde exactamente con π, por ejemplo 9π.`, strategy: d.task === "area" ? "Área = π × radio². No confundas radio con diámetro." : "Longitud = 2 × π × radio. El diámetro equivale a dos radios.", facts: a,
        steps: [["Identifica el radio", `Del centro al borde hay ${d.radius} unidades. El diámetro mide ${a.diameter} unidades.`], ["Distingue longitud y superficie", "La circunferencia es el borde; el círculo incluye la superficie interior. Longitud en u y área en u²."], ["Sustituye en la fórmula", d.task === "area" ? `A = π × ${d.radius}² = ${a.coefficient}π u².` : `C = 2 × π × ${d.radius} = ${a.coefficient}π u.`], ["Separa exactitud y aproximación", `Resultado exacto: ${a.coefficient}π ${a.units}. Con π aproximado: ≈ ${a.approximate.toFixed(3)} ${a.units}. No son dos resultados exactos distintos.`]] };
    }
    case "statistics": {
      const d = object.data, a = statisticsInfo(d);
      const answer: ExactAnswer = d.task === "mode" ? { values: a.modes } : d.task === "mean" ? a.mean : a.median;
      const result = d.task === "mode" ? a.modes.join(", ") || "sin moda" : fractionText(d.task === "mean" ? a.mean : a.median);
      return { answer, result, prompt: `Calcula ${d.task === "mean" ? "la media" : d.task === "median" ? "la mediana" : "todas las modas (o escribe sin moda)"} de los datos.`, strategy: d.task === "mean" ? "Suma los datos y divide entre su cantidad." : d.task === "median" ? "Ordena los datos; si hay dos centrales, calcula su promedio." : "Cuenta cuántas veces aparece cada valor. Si ninguno se repite, escribe sin moda.", facts: a,
        steps: [["Organiza los datos", `Orden: ${a.sorted.join(", ")}. Hay ${d.values.length} datos. Cada barra cuenta la frecuencia de un valor.`], ["Reparte para hallar la media", `Suma = ${a.sum}. Media = ${a.sum}/${d.values.length} = ${fractionText(a.mean)}. Es un reparto equilibrado y puede no aparecer en la lista.`], ["Encuentra el centro", `Mediana = ${fractionText(a.median)}. Con cantidad par usamos el promedio de los dos datos centrales, sin eliminar repeticiones.`], ["Reconoce las frecuencias", `Moda: ${a.modes.join(", ") || "sin moda"}. Admitimos varias modas si comparten la frecuencia máxima; si ningún dato se repite, no hay moda.`]] };
    }
    case "probability": {
      const d = object.data, a = probabilityInfo(d);
      return { answer: a.theoretical, result: fractionText(a.theoretical), prompt: `Hay ${d.outcomes} resultados equiprobables y ${d.favorable} favorables. ¿Cuál es la probabilidad teórica?`, strategy: "Divide los casos favorables entre los resultados posibles. La simulación es una muestra, no cambia la probabilidad teórica.", facts: { theoretical: a.theoretical, observed: a.observed, counts: a.counts, successes: a.successes },
        steps: [["Define el experimento", `${d.experiment === "coin" ? "Moneda equilibrada" : d.experiment === "dice" ? "Dado equilibrado" : "Ruleta de sectores iguales"}: ${d.outcomes} resultados posibles. Consideramos favorables los primeros ${d.favorable}, numerados desde 1.`], ["Calcula la probabilidad teórica", `P = ${d.favorable}/${d.outcomes} = ${fractionText(a.theoretical)}. Vale entre 0 y 1; 0 es imposible y 1 es seguro.`], ["Observa los ensayos", `En ${d.trials} ensayos simulados hubo ${a.successes} favorables. Frecuencia observada = ${fractionText(a.observed)}.`], ["Compara sin confundir", "La frecuencia observada puede diferir de la probabilidad teórica. Más ensayos no garantizan una igualdad exacta ni predicen el siguiente resultado."]] };
    }
    case "algebra-tiles": {
      const d = object.data, a = algebraTilesInfo(d);
      const answer: ExactAnswer = a.kind === "unique" ? { n: a.n, d: a.d } : a.kind;
      return { answer, result: equationResult(a), prompt: `Resuelve ${linearSide(d.a, d.b)} = ${linearSide(d.c, d.d)}. Puedes responder sin solución o infinitas.`, strategy: "Haz el mismo cambio en ambos lados de la igualdad. Las piezas x representan el mismo valor; los cuadrados con signo representan constantes.", facts: a,
        steps: [["Relaciona piezas y símbolos", `${linearSide(d.a, d.b)} = ${linearSide(d.c, d.d)}. Las piezas x valen lo mismo; cada cuadrado representa +1 o −1.`], ["Conserva la igualdad", `Restamos (${d.c})x y (${d.b}) en ambos miembros: ${a.coefficient}x = ${a.constant}. Quitar lo mismo a ambos lados conserva la igualdad.`], ["Despeja", a.kind === "unique" ? `Dividimos ambos lados entre ${a.coefficient}, que no es cero: x = ${equationResult(a)}.` : `No dividimos entre cero. La igualdad reducida indica: ${equationResult(a)}.`], ["Comprueba", a.kind === "unique" ? `Sustituimos x = ${a.n}/${a.d}. Ambos miembros valen ${fractionText(rational(d.a * a.n + d.b * a.d, a.d))}.` : a.kind === "none" ? "Queda una igualdad falsa entre constantes; no existe solución." : "Queda 0 = 0: cualquier valor real satisface la igualdad."]] };
    }
    case "powers-roots": {
      const d = object.data, a = powersInfo(d);
      return { answer: { n: a.answer, d: 1 }, result: String(a.answer), prompt: d.task === "root" ? `Calcula ${a.rootSymbol}${a.power}, la raíz ${d.exponent === 2 ? "cuadrada principal" : "cúbica"}.` : `Calcula ${d.base}^${d.exponent}.`, strategy: d.task === "root" ? "Busca qué número, multiplicado por sí mismo el número de veces indicado, reconstruye la cantidad." : "El exponente cuenta factores iguales, no una multiplicación de base por exponente.", facts: a,
        steps: [["Lee base y exponente", `${d.base}^${d.exponent} tiene base ${d.base} y ${d.exponent} factores iguales.`], ["Construye la cantidad", `${a.factors.join(" × ")} = ${a.power}. ${d.exponent === 2 ? "El cuadrado organiza filas y columnas iguales." : d.exponent === 3 ? "El cubo organiza capas cuadradas iguales." : "Con exponente 1 conservamos una sola copia de la base."}`], ["Invierte para hallar la raíz", d.exponent >= 2 ? `${a.rootSymbol}${a.power} = ${d.base}. Mostramos raíces exactas; la raíz cuadrada principal es no negativa.` : "La potencia de exponente 1 devuelve la propia base."], ["Comprueba", `Multiplicar ${d.exponent} factores iguales a ${d.base} reconstruye ${a.power}. No confundas ${d.base}^${d.exponent} con ${d.base} × ${d.exponent}.`]] };
    }
    case "measurement": {
      const d = object.data, a = measurementInfo(d);
      return { answer: a.answer, result: fractionText(a.answer), prompt: `Convierte ${d.value} ${a.from.label} a ${a.to.label}. Responde solo con la cantidad.`, strategy: "Multiplica por el factor de conversión de la misma magnitud; la cantidad física se conserva.", facts: a,
        steps: [["Identifica la magnitud", `Convertimos ${a.from.label} a ${a.to.label}. Ambas unidades miden ${a.from.family === "length" ? "longitud" : a.from.family === "area" ? "superficie" : a.from.family === "time" ? "tiempo" : "capacidad"}.`], ["Relaciona las unidades", `1 ${a.from.label} = ${fractionText(a.factor)} ${a.to.label}.${a.from.family === "area" ? " En superficie, el factor lineal se eleva al cuadrado: 1 m² = 10000 cm²." : " No se suman ni restan unidades para convertir."}`], ["Convierte", `${d.value} × ${fractionText(a.factor)} = ${fractionText(a.answer)}. Por tanto ${d.value} ${a.from.label} = ${fractionText(a.answer)} ${a.to.label}.`], ["Comprueba el sentido", a.from.scale > a.to.scale ? "Al usar una unidad más pequeña, el número de unidades aumenta, salvo que la cantidad sea cero." : a.from.scale < a.to.scale ? "Al usar una unidad mayor, el número de unidades disminuye, salvo que la cantidad sea cero." : "Son la misma unidad: el valor numérico se conserva."]] };
    }
  }
}
export function validateLearning(payload: LearningPayload): boolean { try { return Boolean(learningLesson(payload)); } catch { return false; } }
export function symbolicAnswer(attempt: string, expected: { pi: number } | { values: number[] }): boolean | null {
  if ("values" in expected) {
    if (!expected.values.length) return /^(sin moda|no hay moda)$/i.test(attempt.trim()) ? true : attempt.trim() ? false : null;
    const parts = attempt.trim().split(/[,;\s]+/);
    if (!parts.length || parts.some(s => !/^\d{1,3}$/.test(s))) return null;
    const values = [...new Set(parts.map(Number))].sort((a, b) => a - b);
    return values.length === expected.values.length && values.every((v, i) => v === expected.values[i]);
  }
  const text = attempt.trim().replace(/\s+/g, "").replace(/π/gi, "pi");
  const m = text.match(/^(\d{1,6})?(?:\/(\d{1,6}))?\*?pi$/i);
  if (!m || Number(m[2]) === 0) return null;
  return Number(m[1] ?? 1) === expected.pi * Number(m[2] ?? 1);
}
