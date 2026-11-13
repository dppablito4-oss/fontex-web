import { InlineValue, InlineOnly } from "./InlineValue";
import { useContext, useId } from "react";
import type { PolygonData, FactorizationData } from "../../core/math-engine/adapted-modules";
import { analyzePolygon, analyzeFactors } from "../../core/math-engine/adapted-modules";
import { TeachingLevel } from "./teaching-level";
type Display = { lessonStep?: number; concealAnswers?: boolean };
export function PolygonObject({ data, lessonStep = Infinity, concealAnswers = false }: { data: PolygonData } & Display) {
  const level = useContext(TeachingLevel);
  const advanced = level === "secondary" || level === "introductory";
  const clipId = useId().replace(/:/g, "");
  const analysis = analyzePolygon(data.vertices);
  const minX = Math.min(...data.vertices.map(p => p.x)), maxX = Math.max(...data.vertices.map(p => p.x));
  const minY = Math.min(...data.vertices.map(p => p.y)), maxY = Math.max(...data.vertices.map(p => p.y));
  const scale = Math.min(340 / (maxX - minX), 240 / (maxY - minY));
  const x = (v: number) => 40 + (v - minX) * scale, y = (v: number) => 280 - (v - minY) * scale;
  const points = data.vertices.map(p => `${x(p.x)},${y(p.y)}`).join(" ");
  return <div className="st-polygon">
    <svg viewBox="0 0 420 320" role="img" aria-label={`Polígono de ${analysis.sides} lados sobre cuadrícula de una unidad`}>
      <defs><clipPath id={clipId}><polygon points={points} /></clipPath></defs>
      <polygon points={points} fill="var(--st-piece-primary)" fillOpacity="0.55" stroke="var(--st-piece-primary)" strokeWidth="3" />
      <g clipPath={`url(#${clipId})`} stroke="var(--st-ink)" strokeOpacity="0.35" strokeWidth="0.7">
        {Array.from({ length: maxX - minX + 1 }, (_, i) => <line key={`x${i}`} x1={x(minX + i)} x2={x(minX + i)} y1={y(maxY)} y2={y(minY)} />)}
        {Array.from({ length: maxY - minY + 1 }, (_, i) => <line key={`y${i}`} x1={x(minX)} x2={x(maxX)} y1={y(minY + i)} y2={y(minY + i)} />)}
      </g>
      {data.vertices.map((p, i) => <g key={i}><circle cx={x(p.x)} cy={y(p.y)} r="4" fill="var(--st-ink)" /><text x={x(p.x)} y={y(p.y) - 10} textAnchor="middle" fontSize="13" fill="var(--st-ink)">{String.fromCharCode(65 + i)}{advanced ? ` (${p.x},${p.y})` : ""}</text></g>)}
    </svg>
    <InlineOnly><p className="st-inline-caption">Vértices: <InlineValue field="vertices" value={data.vertices.map(p => `${p.x},${p.y}`).join("; ")} /></p></InlineOnly>
    <p>Cada cuadrado tiene lado 1 unidad. El relleno muestra la superficie; el contorno marca el borde.</p>
    {!concealAnswers && lessonStep >= 2 && <dl className="st-number-stats"><div><dt>Área exacta</dt><dd>{analysis.area} u²</dd></div>{lessonStep >= 3 && <div><dt>Perímetro aproximado</dt><dd>≈ {analysis.perimeter.toFixed(3)} u</dd></div>}</dl>}
  </div>;
}
export function FactorizationObject({ data, lessonStep = Infinity, concealAnswers = false }: { data: FactorizationData } & Display) {
  const analysis = analyzeFactors(data.number);
  const revealed = concealAnswers ? 0 : Math.min(analysis.divisions.length, lessonStep);
  return <div className="st-factorization"><div className="st-factor-number"><InlineValue field="number" value={data.number} /></div>
    {data.number <= 60 && <div className="st-dots" role="img" aria-label={`${data.number} unidades antes de agrupar`}>{Array.from({ length: data.number }, (_, i) => <span key={i} />)}</div>}
    {revealed > 0 && <ol aria-label="Divisiones exactas" className="st-factor-divisions">{analysis.divisions.slice(0, revealed).map((d, i) => <li key={i}><strong>{d.dividend}</strong><span>÷ {d.factor}</span><span>= {d.quotient}</span></li>)}</ol>}
    {!concealAnswers && revealed === analysis.divisions.length && <><p className="st-factor-product" aria-label="Producto de factores primos">{analysis.expression} = {data.number}</p><p>{analysis.prime ? "Este número ya es primo." : "Cada divisor elegido es primo. El producto reconstruye el número inicial."}</p></>}
    {concealAnswers && <p>¿Qué números primos forman este número al multiplicarlos?</p>}
  </div>;
}
