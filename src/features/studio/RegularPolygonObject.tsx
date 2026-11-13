import { useContext } from "react";
import type { RegularPolygonData } from "../../core/math-engine/regular-polygons";
import { measureText, regularPolygonInfo } from "../../core/math-engine/regular-polygons";
import { InlineOnly, InlineValue } from "./InlineValue";
import { TeachingLevel } from "./teaching-level";

export function RegularPolygonObject({ data, step, hidden }: { data: RegularPolygonData; step: number; hidden: boolean }) {
  const level = useContext(TeachingLevel), a = regularPolygonInfo(data);
  const start = data.sides % 2 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / data.sides;
  const vertices = Array.from({ length: data.sides }, (_, i) => ({ x: 210 + 112 * Math.cos(start + i * 2 * Math.PI / data.sides), y: 151 + 112 * Math.sin(start + i * 2 * Math.PI / data.sides) }));
  return <div className="st-regular-polygon">
    <InlineOnly><div className="st-regular-controls"><label><span>Lados iguales</span><InlineValue field="sides" value={data.sides} /></label><label><span>Cada lado mide</span><InlineValue field="sideLength" value={data.sideLength} /></label><InlineValue field="unit" value={data.unit} /></div></InlineOnly>
    <svg viewBox="0 0 420 320" role="img" aria-label={`${a.name}: ${data.sides} lados iguales de ${data.sideLength} ${data.unit}`}>
      <polygon points={vertices.map(p => `${p.x},${p.y}`).join(" ")} fill="var(--st-piece-primary)" fillOpacity=".25" stroke="var(--st-piece-primary)" strokeWidth="3" />
      {vertices.map((p, i) => {
        const q = vertices[(i + 1) % vertices.length]!, mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        const vx = mx - 210, vy = my - 151, length = Math.hypot(vx, vy);
        return <g key={i}><circle cx={p.x} cy={p.y} r="3" fill="currentColor" /><text x={mx + vx / length * 24} y={my + vy / length * 24 + 4} textAnchor="middle" fill="currentColor" fontSize={data.sides > 8 ? 15 : 18}>{measureText(data.sideLength)} {data.unit}</text></g>;
      })}
      {level !== "initial" && level !== "primary" && !hidden && step >= 3 && <><line x1="210" y1="151" x2={(vertices[0]!.x + vertices[1]!.x) / 2} y2={(vertices[0]!.y + vertices[1]!.y) / 2} stroke="currentColor" strokeDasharray="5 4" /><circle cx="210" cy="151" r="3" fill="currentColor" /></>}
      <text x="210" y="311" textAnchor="middle" fill="currentColor" fontSize="18">{a.name}</text>
    </svg>
    <p className="st-regular-note">Todos sus lados y ángulos son iguales. Las medidas indicadas definen la figura.</p>
    {!hidden && step >= 1 && <dl className="st-number-stats"><div><dt>Perímetro</dt><dd>{measureText(a.perimeter)} {data.unit}</dd></div>{step >= 3 && level !== "initial" && <div><dt>Área{a.areaExact ? "" : " aproximada"}</dt><dd>{a.areaExact ? "" : "≈ "}{measureText(a.area, a.areaExact)} {data.unit}²</dd></div>}</dl>}
  </div>;
}
