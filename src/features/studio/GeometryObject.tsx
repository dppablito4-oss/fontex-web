import { InlineValue, InlineOnly, InlineSvgValue } from "./InlineValue";
import { unitOf, measureText } from "../../core/math-engine/regular-polygons";
import { geometryPerimeter } from "../../core/math-engine/geometry";
import type { GeometryData } from "../../core/math-engine/geometry";
export function GeometryObject({ data, lessonStep = Infinity, concealAnswers = false }: { data: GeometryData; lessonStep?: number; concealAnswers?: boolean }) {
  const { base, height, figure } = data, unit = unitOf(data), perimeter = geometryPerimeter(data);
  const scale = Math.min(420 / base, 250 / height), w = base * scale, h = height * scale;
  const grid = base * height <= 200;
  return <div className="st-geometry"><InlineOnly><div className="st-inline-caption"><InlineValue field="figure" value={figure} /> · <InlineValue field="unit" value={unit} /></div></InlineOnly><svg viewBox={`0 0 ${w + 100} ${h + 80}`} role="img" aria-label={`${figure === "triangle" ? "Triángulo rectángulo" : "Rectángulo"}: base ${base}, altura perpendicular ${height} ${unit}`}>
    <rect x="55" y="15" width={w} height={h} fill="var(--st-piece-empty)" stroke="currentColor" strokeDasharray={figure === "triangle" ? "5 5" : undefined} />
    {figure === "triangle" ? <path d={`M55 15 V${15 + h} H${55 + w} Z`} fill="var(--st-piece-primary)" opacity="0.65" stroke="currentColor" /> : <rect x="55" y="15" width={w} height={h} fill="var(--st-piece-primary)" opacity="0.65" />}
    {grid && <g stroke="currentColor" strokeWidth="0.6" opacity="0.5">{Array.from({ length: base - 1 }, (_, i) => <line key={`v${i}`} x1={55 + (i + 1) * scale} x2={55 + (i + 1) * scale} y1={15} y2={15 + h} />)}{Array.from({ length: height - 1 }, (_, i) => <line key={`h${i}`} x1={55} x2={55 + w} y1={15 + (i + 1) * scale} y2={15 + (i + 1) * scale} />)}</g>}
    <InlineSvgValue field="base" value={base} x={55 + w / 2} y={h + 45} width={160} prefix="Base: " suffix={` ${unit}`} /><InlineSvgValue field="height" value={height} x={27} y={15 + h / 2} width={54} suffix={` ${unit}`} />
  </svg><p>{grid ? `La cuadrícula tiene cuadrados de lado 1 ${unit}.` : "Se respetan las proporciones; no se dibuja la cuadrícula completa para mantener la legibilidad."} {figure === "triangle" && "El triángulo coloreado ocupa la mitad del rectángulo."}</p>{!concealAnswers && lessonStep >= 2 && <dl className="st-number-stats"><div><dt>Área exacta</dt><dd>{base * height / (figure === "triangle" ? 2 : 1)} {unit}²</dd></div>{lessonStep >= 3 && <div><dt>Perímetro{Number.isInteger(perimeter) ? "" : " aproximado"}</dt><dd>{Number.isInteger(perimeter) ? "" : "≈ "}{measureText(perimeter)} {unit}</dd></div>}</dl>}</div>;
}
