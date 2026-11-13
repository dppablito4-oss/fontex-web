import { useEffect, useRef, useState } from "react";
import { InlineValue, InlineOnly, InlineEquation } from "./InlineValue";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type {
  CollectionData,
  LinearEquationData,
  NumberLineData,
} from "../../core/document-schema/document";
import {
  analyzeCollection,
  numberLineTicks,
} from "../../core/math-engine/numbers";
import {
  equationResult,
  linearSide,
  solveLinearEquation,
} from "../../core/math-engine/equations";

export function CollectionObject({ data }: { data: CollectionData }) {
  const stats = analyzeCollection(data.values);
  return (
    <div className="st-collection">
      <InlineOnly><p className="st-inline-caption">Datos: <InlineValue field="values" value={data.values.join(", ")} /></p></InlineOnly>
      <ol aria-label="Números de la colección">
        {data.values.map((value, index) => <li key={index}><InlineValue field="values" index={index} value={value} />{value >= 0 && value <= 20 && <div className="st-dots" role="img" aria-label={`${value} puntos`}>{Array.from({ length: value }, (_, i) => <span key={i} />)}</div>}</li>)}
      </ol>
      <dl className="st-number-stats">
        <div>
          <dt>Cantidad</dt>
          <dd>{stats.count}</dd>
        </div>
        <div>
          <dt>Suma</dt>
          <dd>{stats.sum}</dd>
        </div>
        <div>
          <dt>Mínimo</dt>
          <dd>{stats.minimum}</dd>
        </div>
        <div>
          <dt>Máximo</dt>
          <dd>{stats.maximum}</dd>
        </div>
        <div>
          <dt>Media exacta</dt>
          <dd>{stats.mean.n}{stats.mean.d !== 1 ? `/${stats.mean.d}` : ""}</dd>
        </div>
      </dl>
    </div>
  );
}
export function NumberLineObject({ data }: { data: NumberLineData }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderWidth, setRenderWidth] = useState(800);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const resize = () => { const width = svg.getBoundingClientRect().width; if (width > 0) setRenderWidth(width); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const fontSize = Math.max(22, Math.min(54, 16 * 800 / renderWidth));
  const inset = Math.max(40, fontSize * 2);
  const ticks = numberLineTicks(data.min, data.max, data.step);
  const x = (value: number) =>
    inset + (value - data.min) / (data.max - data.min) * (800 - inset * 2);
  const labelStride = Math.max(1, Math.ceil(ticks.length / Math.max(2, Math.floor(renderWidth / 52))));
  const separatedLabels = data.points.every((point, index) =>
    data.points.every((other, otherIndex) =>
      index === otherIndex || Math.abs(x(point) - x(other)) >= fontSize * 2.5
    )
  );
  return (
    <div className="st-number-line">
      <svg
        ref={svgRef}
        viewBox="0 0 800 185"
        role="img"
        aria-label={`Recta de ${data.min} a ${data.max}, paso ${data.step}. Puntos: ${
          data.points.join(", ") || "ninguno"
        }`}
      >
        <line
          x1={20}
          y1={100}
          x2={780}
          y2={100}
          stroke="currentColor"
          strokeWidth={2}
        />
        {ticks.map((value, index) => (
          <g key={value}>
            <line
              x1={x(value)}
              x2={x(value)}
              y1={93}
              y2={107}
              stroke="currentColor"
              strokeWidth={1.5}
            />
            {(index % labelStride === 0 || (index === ticks.length - 1 && index % labelStride >= labelStride / 2)) && <text
              x={x(value)}
              y={150}
              textAnchor="middle"
              fill="currentColor"
              fontSize={fontSize}
            >
              {value}
            </text>}
          </g>
        ))}
        {data.points.map((value) => (
          <g key={value}>
            <line
              x1={x(value)}
              x2={x(value)}
              y1={60}
              y2={100}
              stroke="var(--st-piece-primary)"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(value)}
              cy={60}
              r={6}
              fill="var(--st-piece-primary)"
            />
            {separatedLabels && (
              <text
                x={x(value)}
                y={38}
                textAnchor="middle"
                fill="currentColor"
                fontSize={fontSize + 2}
              >
                {value}
              </text>
            )}
          </g>
        ))}
      </svg>
      {!separatedLabels && <p>Puntos: {data.points.join(", ")}</p>}
      <InlineOnly><p className="st-inline-caption">De <InlineValue field="min" value={data.min} /> a <InlineValue field="max" value={data.max} /> · Puntos: <InlineValue field="points" value={data.points.join(", ")} /></p></InlineOnly>
      <p className="st-math-explanation st-inline-parameters">
        Cada intervalo representa{" "}
        <InlineValue field="step" value={data.step} />. Los números aumentan hacia la derecha.
      </p>
    </div>
  );
}
export function LinearEquationObject(
  { data, onChange }: {
    data: LinearEquationData;
    onChange: (data: LinearEquationData) => void;
  },
) {
  const solution = solveLinearEquation(data);
  return (
    <div className="st-equation">
      <p className="st-equation-expression">
        <InlineEquation {...data}>{linearSide(data.a, data.b)} = {linearSide(data.c, data.d)}</InlineEquation>
      </p>
      {data.stage >= 1 && (
        <p className="st-equation-expression">
          {linearSide(solution.coefficient, 0)} = {solution.constant}
        </p>
      )}
      {data.stage === 2 && (
        <p className="st-equation-result">
          {solution.kind === "unique" ? "x = " : ""}
          {equationResult(solution)}
        </p>
      )}
      <p className="st-math-explanation" aria-live="polite">
        {data.stage === 0
          ? "La igualdad debe conservarse al transformar ambos miembros."
          : data.stage === 1
          ? `Restamos (${data.c})x y (${data.b}) en ambos miembros para reunir las incógnitas y las constantes.`
          : solution.kind === "unique"
          ? `Dividimos ambos miembros por ${solution.coefficient}, que es distinto de cero. La solución satisface la igualdad original.`
          : solution.kind === "none"
          ? "Una igualdad entre constantes distintas es imposible; no existe solución."
          : "La igualdad es cierta para todo número real; hay infinitas soluciones."}
      </p>
      <div className="st-step-buttons">
        <button
          aria-label="Paso anterior de ecuación"
          disabled={data.stage === 0}
          onClick={() => onChange({ ...data, stage: data.stage - 1 })}
        >
          <ArrowLeft size={16} />Anterior
        </button>
        <button
          onClick={() => onChange({ ...data, stage: (data.stage + 1) % 3 })}
        >
          {[
            "Agrupar términos",
            "Comprobar solución",
            "Volver a la igualdad",
          ][data.stage]}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
