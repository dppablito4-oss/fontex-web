import { Component, useEffect, useId, useRef, useState } from "react";
import { AcademicMarkdown } from "../tutor/components/AcademicMarkdown";
import {
  compile,
  displayNumber as num,
  type FunctionDefinition,
  interpolate,
  niceTicks,
  polygonMetrics,
  regionResult,
  sample,
  scalar,
  type Scope,
  shadeContours,
  simplifyStroke,
} from "../../core/primitives/math";
import { polynomial, realRoots } from "../../core/scene/expression";
import {
  type Primitive,
  type PrimitiveScene,
  type SceneVariable,
} from "../../core/primitives/schema";
type Props = {
  p: Primitive;
  scene: PrimitiveScene;
  scope: Scope;
  functions: Record<string, FunctionDefinition>;
  onChange: (p: Primitive) => void;
  onVariable: (name: string, value: number) => void;
  onSelect: (id: string) => void;
  selected: boolean;
  readOnly?: boolean;
};
const safe = (
  source: string,
  scope: Scope,
  functions: Record<string, FunctionDefinition> = {},
) => scalar(source, scope, functions);
function Coordinate(
  { p, scene, scope, functions, onSelect }: Props & {
    p: Extract<Primitive, { kind: "coordinate_canvas" }>;
  },
) {
  const clip = useId();
  const svg = useRef<SVGSVGElement>(null),
    [pixelWidth, setPixelWidth] = useState(800);
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setPixelWidth(node.getBoundingClientRect().width || 800)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const [x0, x1] = p.data.domainX.map((x) => safe(x, scope)) as [
      number,
      number,
    ],
    [y0, y1] = p.data.rangeY.map((x) => safe(x, scope)) as [number, number];
  const W = 800,
    H = p.data.mode === "number_line" ? 190 : 440,
    M = pixelWidth < 500
      ? Math.max(
        72,
        Math.min(
          140,
          ...niceTicks(y0, y1, 3).map((n) => num(n).length * 16 + 16),
        ),
      )
      : 72,
    px = (x: number) => M + (x - x0) / (x1 - x0) * (W - 2 * M),
    py = (y: number) => H - M - (y - y0) / (y1 - y0) * (H - 2 * M);
  const children = scene.primitives.filter((c) =>
    "canvasId" in c.data && c.data.canvasId === p.id
  );
  const path = (segments: { x: number; y: number }[][]) =>
    segments.map((points) =>
      points.map((v, i) => `${i ? "L" : "M"}${px(v.x)},${py(v.y)}`).join(" ")
    ).join(" ");
  const lineY = p.data.mode === "number_line" ? H / 2 : py(0);
  const xTicks = niceTicks(
    x0,
    x1,
    Math.max(3, Math.min(p.data.subdivisions, Math.floor(pixelWidth / 100))),
  );
  const yTicks = niceTicks(
    y0,
    y1,
    Math.max(
      3,
      Math.min(p.data.subdivisions, Math.floor(pixelWidth * .55 / 70)),
    ),
  );
  return (
    <div className="pc-coordinate">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={p.label || "Plano matemático"}
      >
        <defs>
          <clipPath id={clip}>
            <rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} />
          </clipPath>
        </defs>
        {p.data.showGrid && p.data.mode !== "number_line" && (
          <g stroke="var(--pc-grid)" strokeWidth="1">
            {xTicks.map((x) => (
              <path key={`x${x}`} d={`M${px(x)},${M}V${H - M}`} />
            ))}
            {yTicks.map((y) => (
              <path key={`y${y}`} d={`M${M},${py(y)}H${W - M}`} />
            ))}
          </g>
        )}
        {["polar", "unit_circle"].includes(p.data.mode) && (
          <g fill="none" stroke="var(--pc-grid)">
            {[1, 2, 3, 4].map((r) => (
              <ellipse
                key={r}
                cx={px(0)}
                cy={py(0)}
                rx={Math.abs(px(r) - px(0))}
                ry={Math.abs(py(r) - py(0))}
              />
            ))}
            {Array.from({ length: 12 }, (_, i) =>
              i * Math.PI / 6).map((a) => (
                <path
                  key={a}
                  d={`M${px(0)},${py(0)}L${px(4 * Math.cos(a))},${
                    py(4 * Math.sin(a))
                  }`}
                />
              ))}
          </g>
        )}
        {p.data.mode !== "blank_grid" && (
          <path
            d={`M${M},${lineY}H${W - M}${
              p.data.mode !== "number_line" ? `M${px(0)},${M}V${H - M}` : ""
            }`}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        )}
        {p.data.showAxisLabels && (
          <g fill="currentColor" fontSize="16">
            {xTicks.map((x) => (
              <text
                className="pc-x-tick"
                key={`x${x}`}
                x={px(x)}
                y={p.data.mode === "number_line" ? lineY + 28 : H - 12}
                textAnchor="middle"
              >
                {num(x)}
              </text>
            ))}
            {p.data.mode !== "number_line" &&
              yTicks.map((y) => (
                <text key={`y${y}`} x={M - 8} y={py(y) + 5} textAnchor="end">
                  {num(y)}
                </text>
              ))}
          </g>
        )}
        <g clipPath={`url(#${clip})`}>
          {children.map((child) => {
            const stroke = child.style.strokeColor;
            if (child.kind === "function_region") {
              const graph = compile(
                  child.data.expression,
                  scope,
                  child.data.angleUnit,
                ),
                other = child.data.secondaryExpression
                  ? compile(
                    child.data.secondaryExpression,
                    scope,
                    child.data.angleUnit,
                  ).value
                  : () => 0;
              const segments = sample(graph.value, x0, x1, y0, y1);
              const a = safe(child.data.fromExpr, scope),
                b = safe(child.data.toExpr, scope),
                lo = Math.max(x0, Math.min(a, b)),
                hi = Math.min(x1, Math.max(a, b));
              const shading = child.data.showArea && hi > lo
                ? shadeContours(graph.value, other, lo, hi, y0, y1).map(
                  (points) => path([points]) + " Z",
                )
                : [];
              const at = safe(child.data.tangentAt, scope),
                height = graph.value(at),
                slope = graph.slope(at);
              return (
                <g
                  key={child.id}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(child.id);
                  }}
                  opacity={child.style.opacity}
                  role="button"
                  aria-label={`Seleccionar función ${child.data.name}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(child.id);
                  }}
                >
                  {shading.map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill={child.style.fillColor}
                      fillOpacity=".4"
                    />
                  ))}
                  <path
                    d={path(segments)}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={Math.max(2, child.style.strokeWidth)}
                    strokeDasharray={child.style.dashed ? "7 5" : undefined}
                  />
                  <path
                    d={path(segments)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                  />
                  {child.data.showDerivative && (
                    <path
                      d={path(sample(graph.slope, x0, x1, y0, y1))}
                      fill="none"
                      stroke="#bd81e7"
                      strokeWidth="2.5"
                      strokeDasharray="7 5"
                    />
                  )}
                  {child.data.showTangent && Number.isFinite(height) &&
                    Number.isFinite(slope) && (
                    <path
                      d={`M${px(x0)},${py(height + slope * (x0 - at))}L${
                        px(x1)
                      },${py(height + slope * (x1 - at))}`}
                      stroke="#e5aa4f"
                      strokeWidth="2"
                    />
                  )}
                  {child.data.pointXs.map((source) => {
                    const x = safe(source, scope), y = graph.value(x);
                    return Number.isFinite(y)
                      ? (
                        <g key={source}>
                          <circle cx={px(x)} cy={py(y)} r="5" fill={stroke} />
                          <text
                            x={px(x) + 8}
                            y={py(y) - 8}
                            fontSize="15"
                            fill="currentColor"
                          >
                            ({num(x)}, {num(y)})
                          </text>
                        </g>
                      )
                      : null;
                  })}
                </g>
              );
            }
            if (child.kind === "vector_segment") {
              return (
                <Vector
                  key={child.id}
                  {...{ p: child, scope, functions, px, py }}
                  onSelect={() => onSelect(child.id)}
                />
              );
            }
            if (child.kind === "geometric_shape") {
              const vertices = shapeVertices(child, scope);
              return (
                <polygon
                  key={child.id}
                  points={vertices.map(([x, y]) => `${px(x)},${py(y)}`).join(
                    " ",
                  )}
                  fill={child.style.fillColor}
                  fillOpacity=".4"
                  stroke={stroke}
                  strokeWidth="2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(child.id);
                  }}
                />
              );
            }
            return null;
          })}
        </g>
      </svg>
      <div className="pc-plot-legend">
        {children.map((child) =>
          child.kind === "function_region"
            ? (
              <span key={child.id} style={{ color: child.style.strokeColor }}>
                <strong>{child.data.name}(x) = {child.data.expression}</strong>
                {child.data.showDerivative ? " · derivada discontinua" : ""}
                {child.data.showTangent ? " · tangente dorada" : ""}
                {child.data.showArea && (() => {
                  try {
                    const r = regionResult(child, scope);
                    return r.status === "finite"
                      ? ` · ${
                        child.data.areaMode === "signed" ? "Integral" : "Área"
                      } ≈ ${num(r.value)} (error estimado ${
                        r.error.toExponential(1)
                      })`
                      : ` · ${r.message}`;
                  } catch {
                    return " · Área no definida";
                  }
                })()}
                {(() => {
                  const coefficients = polynomial(
                    compile(child.data.expression, scope, child.data.angleUnit)
                      .expression,
                    { a: 0, b: 0, c: 0 },
                  );
                  if (!coefficients) return null;
                  if (coefficients.length > 5) {
                    return (
                      <span className="pc-root-summary">
                        Cálculo de raíces disponible hasta grado 4.
                      </span>
                    );
                  }
                  return (
                    <span className="pc-root-summary">
                      {coefficients.length === 1
                        ? (coefficients[0] === 0
                          ? "La igualdad se cumple para todo x real."
                          : "La expresión constante no tiene ceros.")
                        : `Raíces reales aproximadas: ${
                          realRoots(coefficients).map(num).join("; ") ||
                          "ninguna"
                        }`}
                    </span>
                  );
                })()}
              </span>
            )
            : null
        )}
      </div>
      <small>
        Curvas muestreadas. Las áreas son aproximaciones numéricas; el recorte
        visual no cambia el cálculo.
      </small>
    </div>
  );
}
function Vector({
  p,
  scope,
  functions,
  px = (x: number) => x,
  py = (y: number) => y,
  onSelect = () => {},
}: {
  p: Extract<Primitive, { kind: "vector_segment" }>;
  scope: Scope;
  functions: Record<string, FunctionDefinition>;
  px?: (n: number) => number;
  py?: (n: number) => number;
  onSelect?: () => void;
}) {
  const marker = useId(),
    [a, b] = p.data.start.map((x) => safe(x, scope, functions)) as [
      number,
      number,
    ],
    [c, d] = p.data.end.map((x) => safe(x, scope, functions)) as [
      number,
      number,
    ];
  const angle = Math.atan2(d - b, c - a) * 180 / Math.PI;
  return (
    <g
      stroke={p.style.strokeColor}
      fill={p.style.strokeColor}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <defs>
        <marker
          id={marker}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto-start-reverse"
        >
          <path d="M0,0L8,4L0,8Z" />
        </marker>
      </defs>
      <line
        x1={px(a)}
        y1={py(b)}
        x2={px(c)}
        y2={py(d)}
        strokeWidth={p.style.strokeWidth || 2}
        markerStart={p.data.headStart === "arrow"
          ? `url(#${marker})`
          : undefined}
        markerEnd={p.data.headEnd === "arrow" ? `url(#${marker})` : undefined}
        strokeDasharray={p.style.dashed ? "8 5" : undefined}
      />
      {[{ x: a, y: b, kind: p.data.headStart }, {
        x: c,
        y: d,
        kind: p.data.headEnd,
      }].map((q, i) =>
        q.kind === "dot"
          ? <circle key={i} cx={px(q.x)} cy={py(q.y)} r="5" />
          : q.kind === "bar"
          ? <path key={i} d={`M${px(q.x) - 5},${py(q.y) - 8}l10,16`} />
          : null
      )}
      {p.data.showMagnitude && (
        <text
          x={(px(a) + px(c)) / 2}
          y={(py(b) + py(d)) / 2 - 12}
          fontSize="18"
          stroke="none"
        >
          |v| = {num(Math.hypot(c - a, d - b))}
        </text>
      )}
      {p.data.showAngleArc && (
        <path
          d={`M${px(a) + 25},${py(b)}A25,25 0 0 ${
            (py(d) - py(b)) >= 0 ? 1 : 0
          } ${
            px(a) + 25 * Math.cos(Math.atan2(py(d) - py(b), px(c) - px(a)))
          },${py(b) + 25 * Math.sin(Math.atan2(py(d) - py(b), px(c) - px(a)))}`}
          fill="none"
          strokeWidth="1.5"
        />
      )}
      {p.data.showAngleArc && (
        <text x={px(a) + 12} y={py(b) + 24} fontSize="16" stroke="none">
          θ = {num(angle)}°
        </text>
      )}
    </g>
  );
}
function shapeVertices(
  p: Extract<Primitive, { kind: "geometric_shape" }>,
  scope: Scope,
): [number, number][] {
  if (!p.data.regular) {
    return p.data.verticesExpr.map((
      [x, y],
    ) => [safe(x, scope), safe(y, scope)]);
  }
  const n = p.data.shape === "triangle" ? 3 : p.data.sides,
    r = safe(p.data.sideExpr, scope) / (2 * Math.sin(Math.PI / n));
  return Array.from(
    { length: n },
    (
      _,
      i,
    ) => [
      r * Math.cos(2 * Math.PI * i / n - Math.PI / 2),
      r * Math.sin(2 * Math.PI * i / n - Math.PI / 2),
    ],
  );
}
function Shape(
  { p, scope }: Props & { p: Extract<Primitive, { kind: "geometric_shape" }> },
) {
  const stroke = p.style.strokeColor, fill = p.style.fillColor;
  if (["circle_fraction", "sector"].includes(p.data.shape)) {
    const count = safe(p.data.shadedExpr, scope),
      units = Math.max(1, Math.ceil(count / p.data.divisions)),
      r = safe(p.data.radiusExpr, scope);
    return (
      <div className="pc-circles">
        <strong>
          {num(count)} / {p.data.divisions}
          {p.data.shape === "sector" ? ` · radio ${num(r)} ${p.data.unit}` : ""}
        </strong>
        <div>
          {Array.from(
            { length: units },
            (_, unit) => (
              <svg
                key={unit}
                viewBox="0 0 240 240"
                role="img"
                aria-label={`Unidad ${unit + 1}: fracción circular`}
              >
                {Array.from({ length: p.data.divisions }, (_, i) => {
                  const a = i * 2 * Math.PI / p.data.divisions - Math.PI / 2,
                    b = (i + 1) * 2 * Math.PI / p.data.divisions - Math.PI / 2;
                  const active = Math.max(
                    0,
                    Math.min(1, count - unit * p.data.divisions - i),
                  );
                  return (
                    <g key={i}>
                      <path
                        d={p.data.divisions === 1
                          ? "M120,20A100,100 0 1 1 119.99,20Z"
                          : `M120,120L${120 + 100 * Math.cos(a)},${
                            120 + 100 * Math.sin(a)
                          }A100,100 0 ${b - a > Math.PI ? 1 : 0} 1 ${
                            120 + 100 * Math.cos(b)
                          },${120 + 100 * Math.sin(b)}Z`}
                        fill={active > 0 ? fill : "var(--pc-empty)"}
                        fillOpacity={active > 0 ? Math.max(.25, active) : 1}
                        stroke={stroke}
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </svg>
            ),
          )}
        </div>
        {p.data.shape === "sector" && (
          <p>
            Área del círculo ≈ {num(Math.PI * r * r)} {p.data.unit}² · porción ≈
            {" "}
            {num(Math.PI * r * r * count / p.data.divisions)} {p.data.unit}²
          </p>
        )}
      </div>
    );
  }
  if (
    ["prism", "cylinder", "inclined_plane", "block_mass"].includes(p.data.shape)
  ) {
    return (
      <div>
        <svg
          viewBox="0 0 600 300"
          role="img"
          aria-label="Diagrama geométrico esquemático"
        >
          {p.data.shape === "cylinder"
            ? (
              <g fill={fill} stroke={stroke} strokeWidth="3">
                <path d="M160,80V240A110,35 0 0 0 380,240V80" />
                <ellipse cx="270" cy="80" rx="110" ry="35" />
                <path
                  d="M160,240A110,35 0 0 1 380,240"
                  fill="none"
                  strokeDasharray="6 5"
                />
              </g>
            )
            : p.data.shape === "inclined_plane"
            ? (
              <g fill={fill} stroke={stroke} strokeWidth="3">
                <polygon points="60,250 530,250 530,40" />
                <rect
                  x="270"
                  y="105"
                  width="80"
                  height="60"
                  transform="rotate(-24 310 135)"
                />
              </g>
            )
            : (
              <g fill={fill} stroke={stroke} strokeWidth="3">
                <path d="M130,100L240,40H450V220L340,270H130Z" />
                <path d="M130,100H340V270M340,100L450,40" fill="none" />
              </g>
            )}
          {p.data.showCenterOfMass && (
            <g fill={stroke}>
              <circle cx="290" cy="150" r="7" />
              <text x="305" y="150" fontSize="20">CM (esquema)</text>
            </g>
          )}
        </svg>
        <p>
          Diagrama esquemático · medida de referencia{" "}
          {num(safe(p.data.sideExpr, scope))}{" "}
          {p.data.unit}. No incluye simulación dinámica ni cálculo 3D.
        </p>
      </div>
    );
  }
  const points = shapeVertices(p, scope),
    xs = points.map((q) => q[0]),
    ys = points.map((q) => q[1]),
    xmin = Math.min(...xs),
    xmax = Math.max(...xs),
    ymin = Math.min(...ys),
    ymax = Math.max(...ys),
    s = Math.min(480 / (xmax - xmin || 1), 270 / (ymax - ymin || 1));
  const px = (x: number) => 300 + (x - (xmin + xmax) / 2) * s,
    py = (y: number) => 180 - (y - (ymin + ymax) / 2) * s;
  const { sides, area, angles } = polygonMetrics(points);
  return (
    <div>
      <svg viewBox="0 0 600 360" role="img" aria-label="Figura con sus medidas">
        <polygon
          points={points.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")}
          fill={fill}
          fillOpacity=".55"
          stroke={stroke}
          strokeWidth={p.style.strokeWidth}
        />
        {points.map((q, i) => {
          const r = points[(i + 1) % points.length]!;
          return (
            <g key={i} fill="currentColor" fontSize="17">
              <circle cx={px(q[0])} cy={py(q[1])} r="3" />
              {p.data.showSideLengths && (
                <text
                  x={(px(q[0]) + px(r[0])) / 2}
                  y={(py(q[1]) + py(r[1])) / 2 - 10}
                  textAnchor="middle"
                >
                  {num(sides[i]!)} {p.data.unit}
                </text>
              )}
              {p.data.showAngles && (
                <text x={px(q[0]) + 8} y={py(q[1]) + 20}>
                  {num(angles[i]!)}°
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p>
        {points.length} lados · perímetro{" "}
        <strong>{num(sides.reduce((a, b) => a + b, 0))} {p.data.unit}</strong>
        {" "}
        · área <strong>{num(area)} {p.data.unit}²</strong>
      </p>
    </div>
  );
}
function Control(
  { p, scene, onVariable }: Props & {
    p: Extract<Primitive, { kind: "control_slider" }>;
  },
) {
  const variable = scene.variables.find((v) => v.name === p.data.variableName)!;
  const [playing, setPlaying] = useState(false);
  const ref = useRef(variable);
  useEffect(() => {
    ref.current = variable;
  }, [variable]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const v = ref.current;
      const next = v.value + v.step * p.data.speed;
      onVariable(v.name, next > v.max ? v.min : Number(next.toPrecision(10)));
    }, 120);
    return () => clearInterval(timer);
  }, [playing, onVariable, p.data.speed]);
  return (
    <div className="pc-control">
      <label>
        {variable.name} = <strong>{num(variable.value)} {variable.unit}</strong>
        <input
          type="range"
          aria-label={`Variable ${variable.name}`}
          min={variable.min}
          max={variable.max}
          step={variable.step}
          value={variable.value}
          onChange={(e) => onVariable(variable.name, Number(e.target.value))}
        />
      </label>
      {p.data.controlType === "play_pause"
        ? (
          <button onClick={() => setPlaying(!playing)}>
            {playing ? "Pausar" : "Animar"}
          </button>
        )
        : p.data.controlType === "stepper"
        ? (
          <>
            <button
              aria-label={`Reducir ${variable.name}`}
              disabled={variable.value <= variable.min}
              onClick={() =>
                onVariable(
                  variable.name,
                  Math.max(variable.min, variable.value - variable.step),
                )}
            >
              −
            </button>
            <button
              aria-label={`Aumentar ${variable.name}`}
              disabled={variable.value >= variable.max}
              onClick={() =>
                onVariable(
                  variable.name,
                  Math.min(variable.max, variable.value + variable.step),
                )}
            >
              +
            </button>
          </>
        )
        : null}
    </div>
  );
}
function Chart(
  { p, scope, functions }: Props & {
    p: Extract<Primitive, { kind: "data_chart" }>;
  },
) {
  const rows = p.data.rows.map((r) => ({
    ...r,
    x: safe(r.xExpr, scope, functions),
    y: safe(r.valueExpr, scope, functions),
  }));
  if (!rows.length) return <p>Añade filas para representar tus datos.</p>;
  const meanX = rows.reduce((s, r) => s + r.x, 0) / rows.length,
    meanY = rows.reduce((s, r) => s + r.y, 0) / rows.length;
  const ssx = rows.reduce((s, r) => s + (r.x - meanX) ** 2, 0),
    slope = ssx
      ? rows.reduce((s, r) => s + (r.x - meanX) * (r.y - meanY), 0) / ssx
      : NaN,
    intercept = meanY - slope * meanX;
  const total = rows.reduce((s, r) => s + r.y, 0);
  let angle = -Math.PI / 2;
  const histogram = (() => {
    const values = rows.map((r) => r.y),
      lo = Math.min(...values),
      hi = Math.max(...values),
      n = Math.max(1, Math.min(12, Math.ceil(Math.sqrt(values.length)))),
      step = (hi - lo || 1) / n;
    return Array.from(
      { length: n },
      (_, i) => ({
        label: `${num(lo + i * step)}–${num(lo + (i + 1) * step)}`,
        x: i,
        y: values.filter((v) =>
          Math.min(n - 1, Math.floor((v - lo) / step)) === i
        ).length,
      }),
    );
  })();
  const data = p.data.chartType === "histogram" ? histogram : rows;
  const xmin = Math.min(0, ...data.map((r) => r.x)),
    xmax = Math.max(1, ...data.map((r) => r.x)),
    ymin = Math.min(0, ...data.map((r) => r.y)),
    ymax = Math.max(1, ...data.map((r) => r.y)),
    px = (x: number) => 60 + (x - xmin) / (xmax - xmin || 1) * 660,
    py = (y: number) => 310 - (y - ymin) / (ymax - ymin || 1) * 260;
  return (
    <div className="pc-chart">
      {p.data.chartType !== "table_only" && (
        <svg
          viewBox="0 0 800 380"
          role="img"
          aria-label={`Gráfico ${p.data.chartType}`}
        >
          {p.data.chartType === "pie"
            ? (total > 0 && rows.every((r) => r.y >= 0)
              ? rows.map((r, i) => {
                const start = angle;
                angle += r.y / total * 2 * Math.PI;
                const d = r.y === total
                  ? "M400,55A130,130 0 1 1 399.99,55Z"
                  : `M400,185L${400 + 130 * Math.cos(start)},${
                    185 + 130 * Math.sin(start)
                  }A130,130 0 ${angle - start > Math.PI ? 1 : 0} 1 ${
                    400 + 130 * Math.cos(angle)
                  },${185 + 130 * Math.sin(angle)}Z`;
                return (
                  <path
                    key={i}
                    d={d}
                    fill={[
                      p.style.fillColor,
                      p.style.strokeColor,
                      "#ba97e4",
                      "#eeb16c",
                      "#82b6e9",
                    ][i % 5]}
                    stroke="var(--pc-bg)"
                  />
                );
              })
              : (
                <text x="80" y="150" fill="currentColor">
                  El gráfico circular requiere valores no negativos y suma
                  positiva.
                </text>
              ))
            : (
              <>
                <path
                  d={`M60,30V${py(0)}H740`}
                  fill="none"
                  stroke="currentColor"
                />
                {data.map((r, i) =>
                  p.data.chartType === "scatter"
                    ? (
                      <circle
                        key={i}
                        cx={px(r.x)}
                        cy={py(r.y)}
                        r="7"
                        fill={p.style.strokeColor}
                      />
                    )
                    : (
                      <g key={i}>
                        <rect
                          x={65 + i * 660 / data.length}
                          y={Math.min(py(r.y), py(0))}
                          width={Math.max(1, 660 / data.length - 8)}
                          height={Math.max(1, Math.abs(py(r.y) - py(0)))}
                          fill={p.style.fillColor}
                          stroke={p.style.strokeColor}
                        />
                        <text
                          x={65 + (i + .5) * 660 / data.length}
                          y="340"
                          fill="currentColor"
                          textAnchor="middle"
                          fontSize={data.length > 12 ? 10 : 17}
                        >
                          {r.label}
                        </text>
                        <text
                          x={65 + (i + .5) * 660 / data.length}
                          y={py(r.y) - 8}
                          fill="currentColor"
                          textAnchor="middle"
                          fontSize="17"
                        >
                          {num(r.y)}
                        </text>
                      </g>
                    )
                )}
                {p.data.chartType === "scatter" &&
                  p.data.showLinearRegression && Number.isFinite(slope) && (
                  <path
                    d={`M${px(xmin)},${py(slope * xmin + intercept)}L${
                      px(xmax)
                    },${py(slope * xmax + intercept)}`}
                    stroke="#be89e4"
                    strokeWidth="2"
                  />
                )}
              </>
            )}
        </svg>
      )}
      {p.data.showLinearRegression && (
        <p>
          {Number.isFinite(slope)
            ? `Regresión: y ≈ ${num(slope)}x + ${
              num(intercept)
            }. Una asociación no implica causalidad.`
            : "No se puede estimar una pendiente con estos valores de x."}
        </p>
      )}
      <div className="pc-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{p.data.headers[0]}</th>
              <th>{p.data.headers[1]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.label}</td>
                <td>{num(r.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Annotation(
  { p, onChange, selected, readOnly }: Props & {
    p: Extract<Primitive, { kind: "annotation_stroke" }>;
  },
) {
  const [draft, setDraft] = useState<[number, number][] | null>(null);
  const points = useRef<[number, number][]>([]), active = useRef(false);
  const position = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(800, (e.clientX - r.left) / r.width * 800)),
      Math.max(0, Math.min(260, (e.clientY - r.top) / r.height * 260)),
    ];
  };
  if (p.data.mode === "callout_bubble") {
    return (
      <div className="pc-callout">
        <AcademicMarkdown content={p.data.calloutText} />
      </div>
    );
  }
  return (
    <svg
      className={selected && !readOnly ? "pc-ink-active" : ""}
      viewBox="0 0 800 260"
      role="img"
      aria-label="Trazo libre"
      onPointerDown={(e) => {
        if (!selected || readOnly) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = true;
        points.current = [position(e)];
        setDraft(points.current);
      }}
      onPointerMove={(e) => {
        if (!active.current) return;
        e.stopPropagation();
        if (points.current.length < 4096) {
          points.current = [...points.current, position(e)];
        }
        setDraft(points.current);
      }}
      onPointerUp={(e) => {
        if (!active.current) return;
        e.stopPropagation();
        active.current = false;
        const reduced = simplifyStroke(points.current);
        const sampled = reduced.length > 512
          ? reduced.filter((_, i) => i % Math.ceil(reduced.length / 511) === 0)
          : reduced;
        onChange({ ...p, data: { ...p.data, points: sampled } });
        setDraft(null);
      }}
      onPointerCancel={() => {
        active.current = false;
        setDraft(null);
      }}
    >
      <polyline
        points={(draft ?? p.data.points).map((q) => q.join(",")).join(" ")}
        fill="none"
        stroke={p.style.strokeColor}
        strokeWidth={p.data.mode === "highlighter"
          ? 22
          : Math.max(2, p.style.strokeWidth)}
        opacity={p.data.mode === "highlighter" ? .3 : 1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!p.data.points.length && !draft && (
        <text x="30" y="130" fill="currentColor" fontSize="22">
          Selecciona y dibuja aquí con el dedo o el ratón.
        </text>
      )}
    </svg>
  );
}
function PrimitiveBody(props: Props) {
  const { p, scope, functions, onChange, selected, readOnly } = props;
  if (p.kind === "coordinate_canvas") return <Coordinate {...props} p={p} />;
  if (p.kind === "geometric_shape") return <Shape {...props} p={p} />;
  if (p.kind === "control_slider") return <Control {...props} p={p} />;
  if (p.kind === "data_chart") return <Chart {...props} p={p} />;
  if (p.kind === "annotation_stroke") return <Annotation {...props} p={p} />;
  if (p.kind === "math_block") {
    return selected && !readOnly
      ? (
        <div>
          <textarea
            aria-label="Texto y fórmula"
            className="pc-inline-text"
            value={p.data.markdownContent}
            rows={Math.max(3, p.data.markdownContent.split("\n").length + 1)}
            onChange={(e) =>
              onChange({
                ...p,
                data: { ...p.data, markdownContent: e.target.value },
              })}
          />
          <div className="pc-text-preview">
            <AcademicMarkdown
              content={interpolate(p.data.markdownContent, scope, functions)}
            />
          </div>
        </div>
      )
      : (
        <div
          className={`pc-math pc-math-${p.data.variant}`}
          style={{ fontSize: p.style.fontSize }}
        >
          <AcademicMarkdown
            content={interpolate(p.data.markdownContent, scope, functions)}
          />
        </div>
      );
  }
  if (p.kind === "vector_segment") {
    return (
      <svg viewBox="0 0 800 300" role="img" aria-label="Vector">
        <Vector p={p} scope={scope} functions={functions} />
      </svg>
    );
  }
  if (p.kind === "stamp_grid") {
    const rows = safe(p.data.rowsExpr, scope),
      cols = safe(p.data.colsExpr, scope),
      active = safe(p.data.activeCountExpr, scope),
      cell = Math.min(70, 720 / cols),
      height = rows * cell;
    return (
      <div>
        <svg
          viewBox={`0 0 800 ${Math.max(100, height + 40)}`}
          role="img"
          aria-label={`${active} elementos de ${rows * cols}`}
        >
          {Array.from(
            { length: rows * cols },
            (_, i) => (
              <g key={i} opacity={i < active ? 1 : .18}>
                <rect
                  x={40 + i % cols * cell}
                  y={20 + Math.floor(i / cols) * cell}
                  width={cell - 5}
                  height={cell - 5}
                  rx="4"
                  fill={i < active ? p.style.fillColor : "var(--pc-empty)"}
                  stroke={p.style.strokeColor}
                />
                <text
                  x={40 + (i % cols + .5) * cell - 2}
                  y={20 + (Math.floor(i / cols) + .7) * cell}
                  textAnchor="middle"
                  fontSize={cell * .55}
                >
                  {({
                    apple: "🍎",
                    star: "★",
                    cube: "▣",
                    coin: "●",
                    circle: "●",
                    atom: "⚛",
                  })[p.data.icon]}
                </text>
              </g>
            ),
          )}
        </svg>
        <p>
          <strong>{active}</strong> de {rows * cols} · {rows} filas × {cols}
          {" "}
          columnas{p.data.groupBy > 1
            ? ` · ${
              Math.floor(active / p.data.groupBy)
            } grupos de ${p.data.groupBy} y ${active % p.data.groupBy} sueltos`
            : ""}
        </p>
      </div>
    );
  }
  const coefficients = polynomial(
    compile(p.data.expression, scope, p.data.angleUnit).expression,
    { a: 0, b: 0, c: 0 },
  );
  return (
    <div>
      <p>{p.data.name}(x) = {p.data.expression}</p>
      {coefficients && coefficients.length > 1 && coefficients.length <= 5 && (
        <p>
          Raíces reales aproximadas:{" "}
          {realRoots(coefficients).map(num).join(", ") || "ninguna"}
        </p>
      )}
    </div>
  );
}
class Boundary extends Component<
  { resetKey: string; children: React.ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error
        ? error.message
        : "No se puede representar este valor.",
    };
  }
  componentDidUpdate(previous: { resetKey: string }) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }
  render() {
    return this.state.error
      ? <p className="pc-error" role="status">{this.state.error}</p>
      : this.props.children;
  }
}
export function PrimitiveVisual(props: Props) {
  return (
    <Boundary resetKey={JSON.stringify([props.p, props.scope])}>
      <PrimitiveBody {...props} />
    </Boundary>
  );
}
export type { Props as PrimitiveVisualProps, SceneVariable };
