import { InlineValue, InlineOnly, InlineSvgValue } from "./InlineValue";
import type { GeometryData } from "../../core/math-engine/geometry";
export function GeometryObject({ data: { base, height, figure } }: { data: GeometryData }) {
  const scale = Math.min(420 / base, 250 / height), w = base * scale, h = height * scale;
  const grid = base * height <= 200;
  return <div className="st-geometry"><InlineOnly><div className="st-inline-caption"><InlineValue field="figure" value={figure} /></div></InlineOnly><svg viewBox={`0 0 ${w + 100} ${h + 80}`} role="img" aria-label={`${figure === "triangle" ? "Triángulo rectángulo" : "Rectángulo"}: base ${base}, altura perpendicular ${height}`}>
    <rect x="55" y="15" width={w} height={h} fill="var(--st-piece-empty)" stroke="currentColor" strokeDasharray={figure === "triangle" ? "5 5" : undefined} />
    {figure === "triangle" ? <path d={`M55 15 V${15 + h} H${55 + w} Z`} fill="var(--st-piece-primary)" opacity="0.65" stroke="currentColor" /> : <rect x="55" y="15" width={w} height={h} fill="var(--st-piece-primary)" opacity="0.65" />}
    {grid && <g stroke="currentColor" strokeWidth="0.6" opacity="0.5">{Array.from({ length: base - 1 }, (_, i) => <line key={`v${i}`} x1={55 + (i + 1) * scale} x2={55 + (i + 1) * scale} y1={15} y2={15 + h} />)}{Array.from({ length: height - 1 }, (_, i) => <line key={`h${i}`} x1={55} x2={55 + w} y1={15 + (i + 1) * scale} y2={15 + (i + 1) * scale} />)}</g>}
    <InlineSvgValue field="base" value={base} x={55 + w / 2} y={h + 45} width={160} prefix="Base: " suffix=" u" /><InlineSvgValue field="height" value={height} x={27} y={15 + h / 2} width={54} suffix=" u" />
  </svg><p>{grid ? "La cuadrícula tiene cuadrados de lado 1 unidad." : "Se respetan las proporciones; no se dibuja la cuadrícula completa para mantener la legibilidad."} {figure === "triangle" && "El triángulo coloreado ocupa la mitad del rectángulo."}</p></div>;
}
