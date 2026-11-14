import { useId, useMemo, type ReactNode } from "react";
import { compileFunctionGraph, functionGraphFacts, graphNumber, sampleFunctionGraph, type FunctionGraphData, type GraphPoint } from "../../core/math-engine/function-graphs";
import { InlineOnly, InlineValue } from "./InlineValue";
import { PolynomialControls, PolynomialExpression } from "./PolynomialControls";
import { isPolynomialEquation, polynomialCoefficients } from "../../core/math-engine/polynomial-editor";
import { ExpressionMath } from "./ExpressionMath";
import { superscriptPowers } from "../../core/math-engine/math-notation";

export function FunctionGraphObject({ data, concealAnswers = false, asideContent }: { data: FunctionGraphData; concealAnswers?: boolean; asideContent?: ReactNode }) {
  const clipId = useId();
  const polynomial = polynomialCoefficients(data.source, data), equation = isPolynomialEquation(data.source);
  const analysis = useMemo(() => ({
    graph: compileFunctionGraph(data), facts: functionGraphFacts(data),
    curve: sampleFunctionGraph(data), derivative: data.showDerivative ? sampleFunctionGraph(data, true) : [],
  }), [data]);
  const width = 900, height = 460, left = 80, right = 30, top = 30, bottom = 70;
  const px = (x: number) => left + (x - data.xMin) / (data.xMax - data.xMin) * (width - left - right);
  const py = (y: number) => height - bottom - (y - data.yMin) / (data.yMax - data.yMin) * (height - top - bottom);
  const path = (points: GraphPoint[]) => points.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(3)},${py(p.y).toFixed(3)}`).join(" ");
  const xTicks = Array.from({ length: 5 }, (_, i) => data.xMin + (data.xMax - data.xMin) * i / 4);
  const yTicks = Array.from({ length: 5 }, (_, i) => data.yMin + (data.yMax - data.yMin) * i / 4);
  const angular = analysis.graph.trigonometric ? data.angleUnit === "degrees" ? "°" : "rad" : "";
  const table = <table className="st-function-table"><caption>Puntos calculados de la función</caption><thead><tr><th>x{angular && ` (${angular})`}</th><th>f(x)</th>{data.showDerivative && <th>f′(x)</th>}</tr></thead><tbody>{analysis.facts.samples.map(p => <tr key={p.x}><td>{graphNumber(p.x)}</td><td>{p.y === null ? "No definido" : graphNumber(p.y)}</td>{data.showDerivative && <td>{p.slope === null ? "No definido" : graphNumber(p.slope)}</td>}</tr>)}</tbody></table>;
  return <div className="st-function-graph">
    <header className="st-function-heading">
    <p className="st-function-expression">{polynomial ? <PolynomialExpression coefficients={polynomial} equation={equation} /> : equation ? <><ExpressionMath source={data.source.split("=")[0]!} /> = <ExpressionMath source={data.source.split("=")[1]!} /></> : <>f(x) = <ExpressionMath source={data.source} /></>}</p>
    <div className="st-function-legend"><span>Función</span>{data.showDerivative && <span className="st-function-derivative-key">Derivada</span>}</div>
    </header>
    <div className="st-function-grid">
    <div className="st-function-plot" aria-label="Área de la gráfica">
    <svg className="st-function-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Gráfica de ${superscriptPowers(data.source)}${angular ? ` en ${data.angleUnit === "degrees" ? "grados" : "radianes"}` : ""}, de x ${data.xMin} a ${data.xMax}`}>
      <defs><clipPath id={clipId}><rect x={left} y={top} width={width - left - right} height={height - top - bottom} /></clipPath></defs>
      {xTicks.map(x => <g key={x}><line x1={px(x)} x2={px(x)} y1={top} y2={height - bottom} stroke="currentColor" opacity="0.12" /><text x={px(x)} y={height - bottom + 29} textAnchor="middle" fill="currentColor" fontSize="21">{graphNumber(x)}</text></g>)}
      {yTicks.map(y => <g key={y}><line x1={left} x2={width - right} y1={py(y)} y2={py(y)} stroke="currentColor" opacity="0.12" /><text x={left - 12} y={py(y) + 7} textAnchor="end" fill="currentColor" fontSize="21">{graphNumber(y)}</text></g>)}
      <rect x={left} y={top} width={width - left - right} height={height - top - bottom} fill="none" stroke="currentColor" opacity="0.3" />
      {data.yMin <= 0 && data.yMax >= 0 && <line x1={left} x2={width - right} y1={py(0)} y2={py(0)} stroke="currentColor" opacity="0.7" />}
      {data.xMin <= 0 && data.xMax >= 0 && <line x1={px(0)} x2={px(0)} y1={top} y2={height - bottom} stroke="currentColor" opacity="0.7" />}
      <g clipPath={`url(#${clipId})`}>
        {analysis.curve.map((points, i) => <path key={i} data-function-curve="true" d={path(points)} fill="none" stroke="var(--st-piece-primary)" strokeWidth="3.5" />)}
        {analysis.derivative.map((points, i) => <path key={i} d={path(points)} fill="none" stroke="var(--st-piece-secondary)" strokeWidth="3" strokeDasharray="8 5" />)}
        {analysis.facts.samples.filter(p => p.y !== null).map(p => <circle key={p.x} data-function-point={p.x} cx={px(p.x)} cy={py(p.y!)} r="6" fill="var(--st-piece-primary)" stroke="var(--st-piece-stroke)" strokeWidth="1"><title>{`(${graphNumber(p.x)}, ${graphNumber(p.y!)})`}</title></circle>)}
      </g>
      <text x={(left + width - right) / 2} y={height - 8} textAnchor="middle" fill="currentColor" fontSize="23">x{angular && ` (${angular})`}</text>
      <text x="18" y={top - 7} fill="currentColor" fontSize="22">f(x)</text>
    </svg>
    {!analysis.curve.length && <p role="status">No hay un tramo real visible en esta ventana. Revisa el dominio y la escala.</p>}
    <p className="st-function-caption">Curva muestreada numéricamente.{analysis.graph.trigonometric && ` Ángulos en ${data.angleUnit === "degrees" ? "grados" : "radianes"}.`}{data.showDerivative && " Trazo discontinuo: derivada respecto a x."} Los valores no definidos y las asíntotas separan los trazos.</p>
    </div>
    <aside className="st-function-sidebar" aria-label="Datos y explicación de la función">
      <PolynomialControls data={data} concealAnswers={concealAnswers} />
      {analysis.facts.samples.length > 0 && <div className="st-function-table-wrap">{concealAnswers ? <details><summary>Comprobar los valores de los puntos</summary>{table}</details> : table}</div>}
      {asideContent}
      <InlineOnly><details className="st-function-config"><summary>Ajustes de la gráfica</summary>
        <div className="st-function-source"><span>Expresión libre</span><InlineValue field="source" value={data.source} /><small>Puedes escribir potencias como x² o x³.</small></div>
        {!polynomial && <p className="st-function-parameters">{(["a", "b", "c"] as const).map(name => <span key={name}>{name} = <InlineValue field={name} value={data[name]} /></span>)}</p>}
        <div className="st-function-settings">
          <label>Ángulos: <InlineValue field="angleUnit" value={data.angleUnit} /></label>
          <label>x desde <InlineValue field="xMin" value={data.xMin} /> hasta <InlineValue field="xMax" value={data.xMax} /></label>
          <label>y desde <InlineValue field="yMin" value={data.yMin} /> hasta <InlineValue field="yMax" value={data.yMax} /></label>
          <label>Puntos: <InlineValue field="pointXs" value={data.pointXs} /></label>
          <InlineValue field="showDerivative" value={data.showDerivative} />
        </div>
      </details></InlineOnly>
    </aside>
    </div>
  </div>;
}
