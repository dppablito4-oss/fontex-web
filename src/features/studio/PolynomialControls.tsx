import { useContext } from "react";
import type { FunctionGraphData } from "../../core/math-engine/function-graphs";
import { graphNumber } from "../../core/math-engine/function-graphs";
import { isPolynomialEquation, MAX_POLYNOMIAL_DEGREE, polynomialCoefficients, polynomialSolutions, polynomialSource } from "../../core/math-engine/polynomial-editor";
import { InlineEditingContext } from "./inline-editing-context";
import { InlineValue } from "./InlineValue";

export function PolynomialControls({ data, concealAnswers }: { data: FunctionGraphData; concealAnswers: boolean }) {
  const editor = useContext(InlineEditingContext);
  const ascending = polynomialCoefficients(data.source, data);
  if (!ascending) return null;
  const coefficients = [...ascending];
  while (coefficients.length < 3) coefficients.push(0);
  coefficients.reverse();
  const degree = coefficients.length - 1, equation = isPolynomialEquation(data.source);
  function change(values: number[], asEquation = equation) {
    if (editor?.object.type !== "function-graph") return;
    editor.onEnd?.(); editor.onBegin?.();
    editor.onChange({ ...editor.object, data: { ...data, source: polynomialSource(values, asEquation) } });
    editor.onEnd?.();
  }
  const solutions = polynomialSolutions(ascending);
  return <section className="st-polynomial" aria-label="Editor de coeficientes del polinomio">
    <div className="st-polynomial-heading"><strong>{equation ? "Ecuación polinómica" : "Función polinómica"}</strong>{editor && <label>Tipo <select aria-label="Tipo de polinomio" value={equation ? "equation" : "function"} onChange={event => change(coefficients, event.target.value === "equation")}><option value="function">Función</option><option value="equation">Ecuación = 0</option></select></label>}</div>
    <p className="st-polynomial-form" role="math">{!equation && "f(x) = "}{coefficients.map((_, i) => <span key={i}>{i > 0 && " + "}{String.fromCharCode(65 + i)}{degree - i > 0 && <><var>x</var>{degree - i > 1 && <sup>{degree - i}</sup>}</>}</span>)}{equation && " = 0"}</p>
    <div className="st-polynomial-coefficients">{coefficients.map((value, i) => <label key={i}><span>{String.fromCharCode(65 + i)} <small>{degree - i === 0 ? "constante" : <>de x{degree - i > 1 && <sup>{degree - i}</sup>}</>}</small></span><InlineValue field={`coefficient:${i}`} value={value} /></label>)}</div>
    {editor && <div className="st-polynomial-actions"><button type="button" disabled={degree >= MAX_POLYNOMIAL_DEGREE} onClick={() => change([...coefficients, 0])}>Agregar coeficiente {String.fromCharCode(66 + degree)} (grado {degree + 1})</button>{degree > 2 && <button type="button" onClick={() => change(coefficients.slice(0, -1))}>Quitar último coeficiente</button>}</div>}
    <small>El grado efectivo baja si los primeros coeficientes son cero. Grado máximo: 8.</small>
    {equation && !concealAnswers && <div className="st-polynomial-solutions" aria-live="polite">{solutions.kind === "all" ? "Todo número real satisface la igualdad." : solutions.kind === "none" ? "No hay soluciones reales." : solutions.kind === "unsupported" ? "Las soluciones reales se calculan hasta grado 4 y en escalas numéricas admitidas. La gráfica sigue disponible." : `Soluciones reales aproximadas: ${solutions.roots.map(graphNumber).join(", ")}.`}</div>}
  </section>;
}

export function PolynomialExpression({ coefficients, equation }: { coefficients: number[]; equation: boolean }) {
  const terms = coefficients.map((coefficient, power) => ({ coefficient, power })).filter(term => term.coefficient !== 0).reverse();
  return <span className="st-math-expression" role="math">{!equation && "f(x) = "}{!terms.length ? "0" : terms.map(({ coefficient, power }, i) => <span key={power}>{coefficient < 0 ? i ? " − " : "−" : i ? " + " : ""}{power === 0 || Math.abs(coefficient) !== 1 ? String(Math.abs(coefficient)) : ""}{power > 0 && <><var>x</var>{power > 1 && <sup>{power}</sup>}</>}</span>)}{equation && " = 0"}</span>;
}
