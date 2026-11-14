import { unitOf, measureText } from "../../core/math-engine/regular-polygons";
import { geometryPerimeter } from "../../core/math-engine/geometry";
import type { AgentLevel } from "../../core/agent/protocol";
import type { MathObject } from "../../core/document-schema/document";
import { gcd } from "../../core/math-engine/fractions";
import { parseStudioOperation } from "../../core/math-engine/studio-operations";
import { solveLinearEquation, equationResult } from "../../core/math-engine/equations";
import { analyzePolygon, analyzeFactors } from "../../core/math-engine/adapted-modules";
import { isLearningObject } from "../../core/math-engine/learning-types";
import { learningLesson } from "../../core/math-engine/learning-modules";
import { functionGraphLesson } from "../../core/math-engine/function-graphs";
export function lessonSteps(object: MathObject, level: AgentLevel): [string, string][] {
  if (isLearningObject(object)) return learningLesson(object, level).steps;
  const simple = level === "initial" || level === "primary";
  switch (object.type) {
    case "function-graph": return functionGraphLesson(object.data);
    case "text": return [];
    case "polygon": {
      const p = analyzePolygon(object.data.vertices), unit = unitOf(object.data);
      return [["Reconoce la figura", `El contorno tiene ${p.sides} lados. Cada cuadrado de la cuadrícula mide 1 ${unit} de lado.`], ["Distingue borde y superficie", "El perímetro recorre el borde. El área cuenta la superficie que ocupa la figura; se mide en unidades cuadradas."], ["Calcula el área", simple ? `Cuenta cuadrados completos y combina las partes. Puedes descomponer el polígono en rectángulos y triángulos. El área total es ${p.area} ${unit}².` : `Con vértices ordenados, área = |Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)| ÷ 2 = ${p.area} ${unit}². La orientación no cambia el área.`], ["Comprueba el perímetro", `Suma las longitudes de los ${p.sides} lados: perímetro ≈ ${p.perimeter.toFixed(3)} ${unit}. Es una aproximación decimal; el área calculada con esta cuadrícula es exacta.`]];
    }
    case "factorization": {
      const f = analyzeFactors(object.data.number);
      return [["Observa el número", `Vamos a escribir ${object.data.number} como un producto de números primos. Un primo es un entero mayor que 1 con exactamente dos divisores positivos: 1 y él mismo.`], ...f.divisions.map((d, i): [string, string] => [`División ${i + 1}: entre ${d.factor}`, `${d.dividend} ÷ ${d.factor} = ${d.quotient}. Elegimos ${d.factor} porque es primo y la división es exacta.${d.quotient === 1 ? " Llegamos a 1: terminamos." : " Seguimos descomponiendo el cociente."}`]), ["Comprueba el producto", `${f.expression} = ${object.data.number}. Todos los factores son primos.${f.prime ? " El número original ya era primo." : " Si un factor se repite, se puede expresar mediante una potencia."}`]];
    }
    case "fraction": {
      const { numerator: n, denominator: d } = object.data;
      const g = gcd(n, d);
      return [
        ["Reconoce la unidad", "Cada figura completa representa una unidad. Todas las unidades tienen el mismo tamaño."],
        ["Divide en partes iguales", `Cada unidad tiene ${d} partes iguales. El número de abajo (denominador) indica ese tamaño: cada pieza vale 1/${d}.`],
        ["Cuenta las piezas coloreadas", `Hay ${n} piezas coloreadas. El número de arriba (numerador) cuenta las piezas: ${n}/${d}.`],
        ["Comprueba el valor", n >= d ? `${n} piezas forman ${Math.floor(n / d)} unidades completas y sobran ${n % d} piezas de tamaño 1/${d}.` : `Faltan ${d - n} piezas para completar una unidad.`],
        ["Escribe una equivalencia", g > 1 ? `Agrupa de ${g} en ${g}: ${n}/${d} = ${n / g}/${d / g}. Cambia el número de piezas, pero no la cantidad coloreada.` : "No hay un entero mayor que 1 que divida ambos números. La fracción ya está simplificada."],
      ];
    }
    case "operation": {
      const p = parseStudioOperation(object.data.expression);
      const g = gcd(p.total, p.denominator);
      const steps: [string, string][] = [["Lee las cantidades", `${p.a.n}/${p.a.d} ${p.operator} ${p.b.n}/${p.b.d}. Cada figura completa vale lo mismo; cada denominador indica en cuántas piezas iguales se divide.`]];
      if (p.operator === "×") steps.push(
        ["Interpreta la multiplicación", "Tomamos una parte de otra cantidad. En la cuadrícula, el cruce coloreado muestra la parte que elegimos de la primera fracción."],
        ["Cuenta las partes del producto", `${p.a.n} × ${p.b.n} = ${p.total} partes elegidas; ${p.a.d} × ${p.b.d} = ${p.denominator} partes iguales por unidad. No hace falta homogeneizar.`],
      ); else steps.push(
        ["Busca piezas del mismo tamaño", simple ? `Dividimos cada unidad en ${p.denominator} piezas iguales para poder ${p.operator === "+" ? "juntar" : "quitar"} piezas del mismo tamaño.` : `m.c.m.(${p.a.d}, ${p.b.d}) = ${p.denominator}. Este denominador permite expresar ambas cantidades con la misma unidad fraccionaria.`],
        ["Transforma la primera fracción", `${p.a.n}/${p.a.d} × ${p.denominator / p.a.d}/${p.denominator / p.a.d} = ${p.left}/${p.denominator}. Multiplicamos arriba y abajo por el mismo número: el área coloreada no cambia.`],
        ["Transforma la segunda fracción", `${p.b.n}/${p.b.d} × ${p.denominator / p.b.d}/${p.denominator / p.b.d} = ${p.right}/${p.denominator}. Conservamos la cantidad y cambiamos el tamaño de las piezas.`],
        [p.operator === "+" ? "Reúne las piezas" : "Quita las piezas", `${p.left} ${p.operator} ${p.right} = ${p.total}. Cada pieza sigue valiendo 1/${p.denominator}; por eso conservamos el denominador: ${p.total}/${p.denominator}.`],
      );
      steps.push(["Simplifica sin cambiar el valor", g > 1 ? `Dividimos arriba y abajo entre ${g}: ${p.total}/${p.denominator} = ${p.simplified.n}/${p.simplified.d}.` : `${p.total}/${p.denominator} ya está simplificada: no tiene un divisor común mayor que 1.`]);
      steps.push(["Comprueba", p.operator === "×" ? `El resultado exacto es ${p.simplified.n}/${p.simplified.d}. Si un factor está entre 0 y 1, tomar esa parte no aumenta la otra cantidad.` : `Volvemos al denominador común: ${p.simplified.n}/${p.simplified.d} = ${p.total}/${p.denominator}. Coincide con las ${p.total} piezas que acabamos de contar.`]);
      return steps;
    }
    case "geometry": {
      const d = object.data, unit = unitOf(d), perimeter = geometryPerimeter(d);
      return [["Identifica las medidas", `La base mide ${d.base} ${unit} y la altura perpendicular ${d.height} ${unit}. La figura conserva esa proporción.`], ["Construye un rectángulo", `${d.base} columnas × ${d.height} filas = ${d.base * d.height} ${unit}². Cada cuadrado de lado 1 ${unit} cubre una unidad cuadrada.`], ["Calcula el área", d.figure === "triangle" ? `Dos triángulos iguales completan el rectángulo. Uno ocupa la mitad: (${d.base} × ${d.height}) ÷ 2 = ${d.base * d.height / 2} ${unit}².` : `Área = base × altura = ${d.base * d.height} ${unit}².`], ["Comprueba el perímetro", d.figure === "triangle" ? `También cuenta el lado inclinado. Su longitud se obtiene con Pitágoras; el perímetro es ${Number.isInteger(perimeter) ? "" : "aproximadamente "}${measureText(perimeter)} ${unit}.` : `Sumamos los cuatro lados: 2 × (${d.base} + ${d.height}) = ${perimeter} ${unit}. Área y perímetro miden cosas distintas.`]];
    }
    case "sequence": return [["Observa el inicio", `El primer término es ${object.data.start}. Los puntos representan unidades cuando la cantidad es pequeña.`], ["Reconoce el cambio", `De un término al siguiente ${object.data.difference >= 0 ? "añadimos" : "quitamos"} ${Math.abs(object.data.difference)}.`], ["Continúa el patrón", `Tras ${object.data.count} términos, el siguiente es ${object.data.start + object.data.difference * object.data.count}. ${simple ? "Repite el mismo cambio una vez más." : "Regla general: aₙ = a₁ + (n − 1)d."}`]];
    case "collection": {
      const sum = object.data.values.reduce((a, b) => a + b, 0);
      return [["Lee los grupos", `Cada tarjeta es una cantidad: ${object.data.values.join(", ")}. Los puntos muestran cantidades de 0 a 20; los negativos indican una cantidad con signo, no puntos negativos.`], ["Suma en orden", `${object.data.values.join(" + ")} = ${sum}. Conserva el signo de cada cantidad.`], [simple ? "Compara" : "Calcula la media", simple ? `Busca la tarjeta de menor valor y la de mayor valor. Hay ${object.data.values.length} tarjetas.` : `La media es suma ÷ cantidad: ${sum}/${object.data.values.length}. Es un reparto equilibrado, no necesariamente una cantidad presente en la colección.`]];
    }
    case "number-line": return [["Ubica los extremos", `Comenzamos en ${object.data.min} y terminamos en ${object.data.max}. Los valores aumentan hacia la derecha.`], ["Lee la escala", `Cada salto entre marcas vale ${object.data.step}. No confundas la cantidad de marcas con la cantidad de intervalos.`], ["Cuenta los intervalos", `Distancia = ${object.data.max} − (${object.data.min}) = ${object.data.max - object.data.min}. Dividimos entre ${object.data.step}: ${(object.data.max - object.data.min) / object.data.step} intervalos.`]];
    case "linear-equation": {
      const d = object.data, s = solveLinearEquation(d);
      return [["Interpreta la igualdad", "x representa el mismo número desconocido en ambos lados. Cada transformación debe mantener la igualdad."], ["Reúne las incógnitas", `Resta (${d.c})x en los dos miembros. El coeficiente restante es ${d.a} − (${d.c}) = ${s.coefficient}.`], ["Reúne las constantes", `Resta (${d.b}) en los dos miembros. Obtenemos ${s.coefficient}x = ${s.constant}.`], ["Resuelve", s.kind === "unique" ? `Divide ambos miembros entre ${s.coefficient}, distinto de cero: x = ${equationResult(s)}.` : `${s.coefficient}x = ${s.constant}: ${equationResult(s)}. No se puede dividir entre cero.`], ["Comprueba en la igualdad original", s.kind === "unique" ? `Sustituimos x = ${s.n}/${s.d}. Lado izquierdo: (${d.a} × ${s.n} + ${d.b} × ${s.d})/${s.d} = ${d.a * s.n + d.b * s.d}/${s.d}. Lado derecho: (${d.c} × ${s.n} + ${d.d} × ${s.d})/${s.d} = ${d.c * s.n + d.d * s.d}/${s.d}. Coinciden.` : s.kind === "all" ? "Los términos se cancelan y queda 0 = 0, cierta para todo real." : "Queda una igualdad falsa entre constantes: no existe solución."]];
    }
  }
}
