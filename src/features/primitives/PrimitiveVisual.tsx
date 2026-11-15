import { Component, type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { Hand, Maximize, Minus, Plus } from "lucide-react";
import { VariableValueField } from "./VariableValueField";
import { PracticeFields, PracticeValue } from "./PracticeFields";
import { allowedPracticeFields, applyPracticeValue } from "../../core/primitives/practice";
import { PrimitiveFields } from "./PrimitiveFields";
import { plotCompanions } from "../../core/primitives/layout";
import { diagramColor } from "./visual-colors";
import {
  authoredBounds, equalPlotBounds, fitPlotBounds, panPlotBounds,
  shapeVertices, zoomPlotBounds, type PlotBounds,
} from "../../core/primitives/viewport";
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
import { NodeGraph, TruthMatrix, Venn } from "./AdvancedVisual";
import { linkedMatrix } from "../../core/primitives/transforms";
import { curvePoint, sampleCurve } from "../../core/primitives/curves";
import {
  type Matrix,
  transformPoint,
} from "../../core/primitives/linear-algebra";
type Props = {
  p: Primitive;
  scene: PrimitiveScene;
  scope: Scope;
  functions: Record<string, FunctionDefinition>;
  onChange: (p: Primitive) => void;
  onViewportChange?: (p: Extract<Primitive, { kind: "coordinate_canvas" }>) => void;
  onVariable: (name: string, value: number) => void;
  onSelect: (id: string) => void;
  selected: boolean;
  selectedId?: string | null;
  readOnly?: boolean;
  practice?: boolean;
  onPracticeChange?: (scene: PrimitiveScene) => boolean | void;
  visibleStep?: number;
  displayScale?: number;
};
const safe = (
  source: string,
  scope: Scope,
  functions: Record<string, FunctionDefinition> = {},
) => scalar(source, scope, functions);
function Coordinate(
  { p, scene, scope, functions, onSelect, onChange, onVariable, onViewportChange, selectedId, readOnly, practice, onPracticeChange, visibleStep, displayScale = 1 }: Props & {
    p: Extract<Primitive, { kind: "coordinate_canvas" }>;
  },
) {
  const clip = useId();
  const definitionsPanel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let wasOpen = false;
    const before = () => { if (definitionsPanel.current) { wasOpen = definitionsPanel.current.open; definitionsPanel.current.open = true; } };
    const after = () => { if (definitionsPanel.current) definitionsPanel.current.open = wasOpen; };
    window.addEventListener("beforeprint",before); window.addEventListener("afterprint",after);
    return () => { window.removeEventListener("beforeprint",before); window.removeEventListener("afterprint",after); };
  }, []);
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
  }, [displayScale]);
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ x: number; y: number; bounds: PlotBounds } | null>(null);
  const navigate = onViewportChange ?? onChange;
  const automatic = p.data.autoFit ?? true;
  const initial = automatic ? fitPlotBounds(p, scene, scope) : authoredBounds(p, scope);
  const square = p.data.mode === "unit_circle" || p.data.equalScale !== false;
  const W = 800,
    H = p.data.mode === "number_line" ? 310 : 520,
    M = pixelWidth < 500 ? 90 : 64;
  const bounds = square ? equalPlotBounds(initial, (W - 2 * M) / (H - 2 * M)) : initial;
  const [x0, x1, y0, y1] = bounds;
  const
    px = (x: number) =>
      M + (x - x0) / (x1 - x0) * (W - 2 * M),
    py = (y: number) =>
      p.data.mode === "number_line"
        ? H - 68
        : H - M - (y - y0) / (y1 - y0) * (H - 2 * M);
  const changeWindow = (next: PlotBounds) => {
    const values = next.map((v) => String(Number(v.toPrecision(10))));
    navigate({ ...p, data: { ...p.data, autoFit: false,
      referenceWindow: p.data.referenceWindow ?? { domainX: p.data.domainX, rangeY: p.data.rangeY },
      domainX: [values[0]!, values[1]!], rangeY: [values[2]!, values[3]!] } });
  };
  const wheelAction = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheelAction.current = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const box = svg.current!.getBoundingClientRect();
      const ax = Math.max(0, Math.min(1, ((e.clientX - box.left) / box.width * W - M) / (W - 2 * M)));
      const ay = Math.max(0, Math.min(1, 1 - ((e.clientY - box.top) / box.height * H - M) / (H - 2 * M)));
      changeWindow(zoomPlotBounds(bounds, Math.exp(Math.max(-1, Math.min(1, e.deltaY * .002))), [ax, ay]));
    };
  });
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const wheel = (e: WheelEvent) => wheelAction.current(e);
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  const children = scene.primitives.filter((c) =>
    "canvasId" in c.data && c.data.canvasId === p.id &&
    (visibleStep === undefined || c.presentationStep <= visibleStep)
  );
  const companions = plotCompanions(scene, p.id).filter((c) => visibleStep === undefined || c.presentationStep <= visibleStep);
  const definitions = companions.filter((c) => c.kind === "math_block");
  const controls = companions.filter((c) => c.kind === "control_slider");
  const editingChild = children.find((c) => c.id === selectedId);
  const path = (segments: { x: number; y: number }[][]) =>
    segments.map((points) =>
      points.map((v, i) => `${i ? "L" : "M"}${px(v.x)},${py(v.y)}`).join(" ")
    ).join(" ");
  const lineY = py(0);
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
      Math.min(p.data.subdivisions, Math.floor(pixelWidth * H / W / 70)),
    ),
  );
  return (
    <div className="pc-coordinate">
      <div className="pc-plot-overlay" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <details ref={definitionsPanel} className="pc-plot-definitions" open={readOnly || editingChild ? true : undefined}>
          <summary>Definiciones y medidas <span>{children.length} figuras</span></summary>
          <div className="pc-plot-definition-content">
            {definitions.map((item) => <section key={item.id}>
              <AcademicMarkdown content={interpolate(item.data.markdownContent, scope, functions)} />
              {!readOnly && <button onClick={() => onSelect(item.id)}>Editar explicación</button>}
            </section>)}
            {controls.map((item) => <PrimitiveVisual key={item.id} p={item} scene={scene} scope={scope} functions={functions}
              onChange={onChange} onVariable={onVariable} onSelect={onSelect} selected={item.id === selectedId} readOnly={readOnly} practice={practice} onPracticeChange={onPracticeChange} />)}
            {children.map((child) => <button key={child.id} className="pc-plot-definition-link" onClick={() => onSelect(child.id)}>
              <span style={{ color: diagramColor(child.style.strokeColor) }}>●</span>{child.label}
            </button>)}
            {!definitions.length && !children.length && <p>Añade funciones o figuras desde Elementos.</p>}
            {!readOnly && editingChild && editingChild.kind !== "math_block" && <section aria-label="Edición sobre el plano">
              <strong>{editingChild.label}</strong>
              <PrimitiveFields p={editingChild} scene={scene} onChange={onChange} />
            </section>}
          </div>
        </details>
      </div>
      <div className="pc-plot-toolbar" onClick={(e) => e.stopPropagation()}>
        <span className="pc-plot-scale">
          {automatic ? "Escala automática" : "Vista libre"}
          <small>1 división: x {num(xTicks.length > 1 ? xTicks[1]! - xTicks[0]! : x1 - x0)}
            {p.data.mode !== "number_line" && ` · y ${num(yTicks.length > 1 ? yTicks[1]! - yTicks[0]! : y1 - y0)}`}</small>
        </span>
        <div role="group" aria-label="Navegación del plano">
          <button aria-label="Alejar plano" title="Alejar plano" onClick={() => changeWindow(zoomPlotBounds(bounds, 1.4))}><Minus size={16} /></button>
          <button aria-label="Acercar plano" title="Acercar plano" onClick={() => changeWindow(zoomPlotBounds(bounds, 1 / 1.4))}><Plus size={16} /></button>
          <button aria-label="Mover vista del plano" title="Activa y arrastra para mover el plano" aria-pressed={panning} onClick={() => setPanning(!panning)}><Hand size={16} /></button>
          <button aria-label="Ajustar plano a las figuras" title="Ajustar y seguir los cambios de las figuras" onClick={() => navigate({ ...p, data: { ...p.data, ...p.data.referenceWindow, autoFit: true, referenceWindow: null } })}><Maximize size={16} /><span>Ajustar</span></button>
          {!readOnly && <button aria-label="Ampliar plano al ancho del lienzo" title="Usar todo el ancho del lienzo" onClick={() => onChange({ ...p, x: 24, width: 1152, height: Math.max(790, p.height), autoHeight: true })}>Ancho completo</button>}
        </div>
      </div>
      <svg
        ref={svg}
        className={panning ? "pc-plot-panning" : ""}
        style={{ "--pc-plot-label-size": `${16 * Math.max(1, Math.min(2.4, 600 / pixelWidth))}px` } as CSSProperties}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={p.label || "Plano matemático"}
        onPointerDown={(e) => {
          if ((!panning || e.button !== 0) && e.button !== 1 && e.button !== 2) return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          pan.current = { x: e.clientX, y: e.clientY, bounds };
        }}
        onPointerMove={(e) => {
          if (!pan.current) return;
          e.stopPropagation();
          const box = e.currentTarget.getBoundingClientRect(), start = pan.current;
          changeWindow(panPlotBounds(start.bounds,
            -(e.clientX - start.x) / box.width * W / (W - 2 * M) * (start.bounds[1] - start.bounds[0]),
            (e.clientY - start.y) / box.height * H / (H - 2 * M) * (start.bounds[3] - start.bounds[2])));
        }}
        onPointerUp={(e) => {
          if (!pan.current) return;
          e.stopPropagation();
          pan.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => { pan.current = null; }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClickCapture={(e) => { if (panning) { e.stopPropagation(); e.preventDefault(); } }}
      >
        <defs>
          <clipPath id={clip}>
            <rect
              x={M - 8}
              y={p.data.mode === "number_line" ? 8 : M}
              width={W - 2 * M + 16}
              height={p.data.mode === "number_line" ? H - 30 : H - 2 * M}
            />
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
            {(p.data.mode === "unit_circle" ? [1] : [1, 2, 3, 4]).map((r) => (
              <ellipse
                key={r}
                stroke={p.data.mode === "unit_circle"
                  ? "var(--pc-accent)"
                  : undefined}
                strokeWidth={p.data.mode === "unit_circle" ? 2 : 1}
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
                  d={`M${px(0)},${py(0)}L${
                    px((p.data.mode === "unit_circle" ? 1 : 4) * Math.cos(a))
                  },${
                    py((p.data.mode === "unit_circle" ? 1 : 4) * Math.sin(a))
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
            const stroke = diagramColor(child.style.strokeColor);
            if (child.kind === "function_region") {
              if (
                child.data.curveMode && child.data.curveMode !== "cartesian"
              ) {
                const segments = sampleCurve(child, scope, [x0, x1, y0, y1]);
                const parameter = child.data.parameterValueExpr
                  ? safe(child.data.parameterValueExpr, scope)
                  : null;
                const point = parameter === null
                  ? null
                  : curvePoint(child, parameter, scope);
                return (
                  <g
                    key={child.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Seleccionar curva ${child.data.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(child.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSelect(child.id);
                    }}
                  >
                    <path
                      className="pc-parametric-curve"
                      d={path(segments)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={Math.max(2, child.style.strokeWidth)}
                    />
                    <path
                      d={path(segments)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="18"
                    />
                    {point && Number.isFinite(point.x) &&
                      Number.isFinite(point.y) && (
                      <g>
                        <circle
                          className="pc-curve-marker"
                          cx={px(point.x)}
                          cy={py(point.y)}
                          r="6"
                          fill={stroke}
                        />
                        <text
                          x={px(point.x) + 10}
                          y={py(point.y) - 10}
                          fontSize="18"
                          fill="currentColor"
                        >
                          ({num(point.x)}, {num(point.y)})
                        </text>
                      </g>
                    )}
                  </g>
                );
              }
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
                      fill={diagramColor(child.style.fillColor)}
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
                      stroke="var(--ui-math-primary)"
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
                      stroke="var(--ui-math-secondary)"
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
            const matrix = linkedMatrix(child, scene, scope);
            if (matrix === null) {
              return (
                <text
                  key={child.id}
                  x={M + 8}
                  y={M + 24}
                  fill="currentColor"
                  fontSize="18"
                >
                  Matriz singular: no se puede aplicar la inversa.
                </text>
              );
            }
            if (child.kind === "vector_segment") {
              return (
                <Vector
                  key={child.id}
                  {...{ p: child, scope, functions, px, py, matrix }}
                  numberLine={p.data.mode === "number_line"}
                  positiveAngle={p.data.mode === "unit_circle"}
                  onSelect={() => onSelect(child.id)}
                />
              );
            }
            if (child.kind === "geometric_shape") {
              const vertices = shapeVertices(child, scope).map((point) =>
                matrix ? transformPoint(matrix, point) : point
              );
              return (
                <g
                  key={child.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Seleccionar figura ${child.label}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect(child.id);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(child.id);
                  }}
                >
                  <polygon
                    points={vertices.map(([x, y]) => `${px(x)},${py(y)}`).join(
                      " ",
                    )}
                    fill={diagramColor(child.style.fillColor)}
                    fillOpacity=".4"
                    stroke={stroke}
                    strokeWidth="2"
                  />
                  {child.data.showSideLengths && vertices.map(([x, y], i) => {
                    const [ex, ey] = vertices[(i + 1) % vertices.length]!;
                    return (
                      <text
                        key={i}
                        x={(px(x) + px(ex)) / 2 + 10}
                        y={(py(y) + py(ey)) / 2 - 10}
                        fontSize="17"
                        fill="currentColor"
                        textAnchor="middle"
                      >
                        {num(Number(Math.hypot(ex - x, ey - y).toFixed(2)))}
                        {" "}
                        {child.data.unit}
                      </text>
                    );
                  })}
                  {child.data.showAngles &&
                    (() => {
                      try {
                        return polygonMetrics(vertices).angles;
                      } catch {
                        return [];
                      }
                    })().map((angle, i) => (
                      <text
                        key={i}
                        x={px(vertices[i]![0]) + 12}
                        y={py(vertices[i]![1]) + 22}
                        fontSize="16"
                        fill="currentColor"
                      >
                        {num(Number(angle.toFixed(1)))}°
                      </text>
                    ))}
                </g>
              );
            }
            return null;
          })}
        </g>
      </svg>
      <p className="pc-plot-hint"><span className="pc-desktop-gesture">Clic derecho + arrastrar para mover el plano. Ctrl + rueda para acercar o alejar.</span><span className="pc-touch-gesture">Usa + y − para ampliar. Activa la mano y arrastra para mover el plano.</span></p>
      <div className="pc-plot-legend">
        {children.filter((child) => child.kind === "geometric_shape").map((child) => {
          const matrix = linkedMatrix(child, scene, scope);
          if (matrix === null) return null;
          const points = shapeVertices(child, scope).map((point) => matrix ? transformPoint(matrix, point) : point);
          let metrics: ReturnType<typeof polygonMetrics> | null = null;
          try {
            metrics = polygonMetrics(points);
          } catch { /* A singular forward transform can collapse a valid polygon. */ }
          return <button key={child.id} className="pc-shape-summary" onClick={(e) => { e.stopPropagation(); onSelect(child.id); }}>
            <span style={{ background: diagramColor(child.style.strokeColor) }} />
            <strong>{child.label}</strong>
            <span>{metrics
              ? `Área ${num(Number(metrics.area.toFixed(2)))} ${child.data.unit}² · Perímetro ${num(Number(metrics.perimeter.toFixed(2)))} ${child.data.unit}`
              : "Figura colapsada por la transformación"}</span>
          </button>;
        })}
        {children.map((child) =>
          child.kind === "function_region"
            ? (
              <span key={child.id} style={{ color: diagramColor(child.style.strokeColor) }}>
                <strong>
                  {child.data.curveMode === "parametric"
                    ? `${child.data.name}(t) = (${child.data.xExpr}, ${child.data.yExpr})`
                    : child.data.curveMode === "polar"
                    ? `${child.data.name}: r(θ) = ${child.data.rExpr}`
                    : `${child.data.name}(x) = ${child.data.expression}`}
                </strong>
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
                  if (
                    child.data.curveMode && child.data.curveMode !== "cartesian"
                  ) return null;
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
      {children.some((child) => child.kind === "function_region") && (
        <small>
          Curvas muestreadas. Las áreas son aproximaciones numéricas; el recorte
          visual no cambia el cálculo.
        </small>
      )}
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
  numberLine = false,
  positiveAngle = false,
  matrix,
}: {
  p: Extract<Primitive, { kind: "vector_segment" }>;
  numberLine?: boolean;
  positiveAngle?: boolean;
  matrix?: Matrix;
  scope: Scope;
  functions: Record<string, FunctionDefinition>;
  px?: (n: number) => number;
  py?: (n: number) => number;
  onSelect?: () => void;
}) {
  const marker = useId(),
    start = p.data.start.map((x) => safe(x, scope, functions)) as [
      number,
      number,
    ],
    end = p.data.end.map((x) => safe(x, scope, functions)) as [
      number,
      number,
    ];
  const [a, b] = matrix ? transformPoint(matrix, start) : start,
    [c, d] = matrix ? transformPoint(matrix, end) : end;
  const rawAngle = Math.atan2(d - b, c - a) * 180 / Math.PI;
  const angle = positiveAngle && rawAngle < 0 ? rawAngle + 360 : rawAngle;
  const arc = numberLine && (p.data.arcHeight ?? 0) > 0;
  const height = p.data.arcHeight ?? 0;
  const path = arc
    ? `M${px(a)},${py(0)}Q${(px(a) + px(c)) / 2},${py(0) - 2 * height} ${
      px(c)
    },${py(0)}`
    : `M${px(a)},${py(b)}L${px(c)},${py(d)}`;
  const displacement = c - a;
  return (
    <g
      stroke={diagramColor(p.style.strokeColor)}
      fill={diagramColor(p.style.strokeColor)}
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
      <path
        className={arc ? "pc-number-jump" : undefined}
        d={path}
        fill="none"
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
          className={arc ? "pc-jump-label" : undefined}
          textAnchor="middle"
          x={(px(a) + px(c)) / 2}
          y={arc ? py(0) - height - 12 : (py(b) + py(d)) / 2 - 12}
          fontSize="18"
          stroke="none"
          fill="currentColor"
        >
          {arc
            ? `${displacement > 0 ? "+" : ""}${num(displacement)}`
            : `|v| ≈ ${num(Number(Math.hypot(c - a, d - b).toFixed(3)))}`}
        </text>
      )}
      {p.data.showAngleArc && !arc && (
        <path
          d={`M${px(a) + 25},${py(b)}A25,25 0 ${
            positiveAngle && angle > 180 ? 1 : 0
          } ${positiveAngle ? 0 : (py(d) - py(b)) >= 0 ? 1 : 0} ${
            px(a) + 25 * Math.cos(Math.atan2(py(d) - py(b), px(c) - px(a)))
          },${py(b) + 25 * Math.sin(Math.atan2(py(d) - py(b), px(c) - px(a)))}`}
          fill="none"
          strokeWidth="1.5"
        />
      )}
      {p.data.showAngleArc && !arc && (
        <text x={px(a) + 12} y={py(b) + 24} fontSize="16" stroke="none">
          θ = {num(Number(angle.toFixed(1)))}°
        </text>
      )}
    </g>
  );
}
function Shape(
  { p, scope, scene }: Props & {
    p: Extract<Primitive, { kind: "geometric_shape" }>;
  },
) {
  const stroke = diagramColor(p.style.strokeColor), fill = diagramColor(p.style.fillColor);
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
  const matrix = linkedMatrix(p, scene, scope);
  if (matrix === null) {
    return (
      <p role="status">Matriz singular: no se puede aplicar la inversa.</p>
    );
  }
  const points = shapeVertices(p, scope).map((point) =>
      matrix ? transformPoint(matrix, point) : point
    ),
    xs = points.map((q) => q[0]),
    ys = points.map((q) => q[1]),
    xmin = Math.min(...xs),
    xmax = Math.max(...xs),
    ymin = Math.min(...ys),
    ymax = Math.max(...ys),
    s = Math.min(480 / (xmax - xmin || 1), 270 / (ymax - ymin || 1));
  const px = (x: number) => 300 + (x - (xmin + xmax) / 2) * s,
    py = (y: number) => 180 - (y - (ymin + ymax) / 2) * s;
  let metrics;
  try {
    metrics = polygonMetrics(points);
  } catch {
    metrics = {
      sides: points.map((q, i) =>
        Math.hypot(
          q[0] - points[(i + 1) % points.length]![0],
          q[1] - points[(i + 1) % points.length]![1],
        )
      ),
      area: 0,
      angles: [] as number[],
    };
  }
  const { sides, area, angles } = metrics;
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
              {p.data.showAngles && angles[i] !== undefined && (
                <text x={px(q[0]) + 8} y={py(q[1]) + 20}>
                  {num(angles[i])}°
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
  { p, scene, onVariable, readOnly, practice }: Props & {
    p: Extract<Primitive, { kind: "control_slider" }>;
  },
) {
  const variable = scene.variables.find((v) => v.name === p.data.variableName)!;
  const editable=!readOnly || !!practice && allowedPracticeFields(p,scene).some(f=>f.key===`var:${variable.name}`);
  const [playing, setPlaying] = useState(false);
  const ref = useRef(variable);
  useEffect(() => {
    ref.current = variable;
  }, [variable]);
  useEffect(() => {
    if (!editable || !playing || p.data.controlType !== "play_pause") return;
    const timer = setInterval(() => {
      const v = ref.current;
      const next = v.value + v.step * p.data.speed;
      onVariable(v.name, next > v.max ? v.min : Number(next.toPrecision(10)));
    }, 120);
    return () => clearInterval(timer);
  }, [editable, playing, onVariable, p.data.speed, p.data.controlType]);
  return (
    <div className="pc-control">
      <div className="pc-control-main">
        <div className="pc-control-symbol">{variable.name}<small>{variable.unit || "valor"}</small></div>
        {p.data.controlType !== "toggle" && (editable && !practice ? <VariableValueField variable={variable} onChange={onVariable} /> : <strong>{num(variable.value)} {variable.unit}</strong>)}
      </div>
      <label className="pc-range-label">
        <span className="pc-sr-only">Ajustar {variable.name}</span>
        {p.data.controlType === "toggle"
          ? (
            <button
              type="button"
              role="switch"
              disabled={!editable}
              aria-checked={variable.value === 1}
              aria-label={`Proposición ${variable.name}`}
              onClick={() =>
                onVariable(variable.name, Number(variable.value === 0))}
            >
              {variable.value ? "Verdadero · 1" : "Falso · 0"}
            </button>
          )
          : (
            <input
              type="range"
              disabled={!editable}
              aria-label={`Variable ${variable.name}`}
              min={variable.min}
              max={variable.max}
              step={variable.step}
              value={variable.value}
              onChange={(e) =>
                onVariable(variable.name, Number(e.target.value))}
            />
          )}
      </label>
      {p.data.controlType !== "toggle" && <div className="pc-range-limits"><span>{num(variable.min)} {variable.unit}</span><span>{num(variable.max)} {variable.unit}</span></div>}
      {p.data.controlType === "play_pause"
        ? (
          <button disabled={!editable} onClick={() => setPlaying(!playing)}>
            {playing ? "Pausar" : "Animar"}
          </button>
        )
        : p.data.controlType === "stepper"
        ? (
          <>
            <button
              aria-label={`Reducir ${variable.name}`}
              disabled={!editable || variable.value <= variable.min}
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
              disabled={!editable || variable.value >= variable.max}
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
  { p, scope, functions, scene, practice, onPracticeChange, onChange }: Props & {
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
                      diagramColor(p.style.fillColor),
                      diagramColor(p.style.strokeColor),
                      "var(--ui-math-secondary)",
                      "var(--ui-muted-foreground)",
                      "var(--ui-foreground)",
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
                        fill={diagramColor(p.style.strokeColor)}
                      />
                    )
                    : (
                      <g key={i}>
                        <rect
                          x={65 + i * 660 / data.length}
                          y={Math.min(py(r.y), py(0))}
                          width={Math.max(1, 660 / data.length - 8)}
                          height={Math.max(1, Math.abs(py(r.y) - py(0)))}
                          fill={diagramColor(p.style.fillColor)}
                          stroke={diagramColor(p.style.strokeColor)}
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
                    stroke="var(--ui-math-secondary)"
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
                <td>{practice ? <PracticeValue p={p} scene={scene} fieldKey={`rows.${i}.valueExpr`} fallback={num(r.y)}
                  onApply={onPracticeChange ?? (next=>onChange(next.primitives.find(item=>item.id===p.id)!))}/> : num(r.y)}</td>
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
        stroke={diagramColor(p.style.strokeColor)}
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
  const { p, scope, functions } = props;
  if (p.kind === "answer_field") return <div className="pc-answer-field"><AcademicMarkdown content={p.data.prompt} />{!props.practice && <p className="pc-answer-preview">{p.data.answer || "Respuesta: ____________________"}</p>}</div>;
  if (p.kind === "coordinate_canvas") return <Coordinate {...props} p={p} />;
  if (p.kind === "geometric_shape") {
    return p.data.shape === "venn_2" || p.data.shape === "venn_3"
      ? <Venn {...props} p={p} />
      : <Shape {...props} p={p} />;
  }
  if (p.kind === "node_graph") return <NodeGraph {...props} p={p} />;
  if (p.kind === "control_slider") return <Control {...props} p={p} />;
  if (p.kind === "data_chart") {
    return p.data.chartType === "matrix" || p.data.chartType === "truth_table"
      ? <TruthMatrix {...props} p={p} />
      : <Chart {...props} p={p} />;
  }
  if (p.kind === "annotation_stroke") return <Annotation {...props} p={p} />;
  if (p.kind === "math_block") {
    return (
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
    const matrix = linkedMatrix(p, props.scene, scope);
    if (matrix === null) {
      return (
        <p role="status">Matriz singular: no se puede aplicar la inversa.</p>
      );
    }
    return (
      <svg viewBox="0 0 800 300" role="img" aria-label="Vector">
        <Vector p={p} scope={scope} functions={functions} matrix={matrix} />
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
                  fill={i < active ? diagramColor(p.style.fillColor) : "var(--pc-empty)"}
                  stroke={diagramColor(p.style.strokeColor)}
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
  const {p,scene}=props;
  const apply=(next:PrimitiveScene) => {
    if(props.onPracticeChange) return props.onPracticeChange(next);
    const updated=next.primitives.find(n=>n.id===p.id)!;
    props.onChange(updated);
    for(const v of next.variables) if(scene.variables.find(old=>old.name===v.name)?.value!==v.value) props.onVariable(v.name,v.value);
  };
  const drawing=props.practice && p.kind==="annotation_stroke" && allowedPracticeFields(p,scene).some(f=>f.key==="points");
  const bodyProps:Props=props.practice ? {...props,readOnly:!drawing,selected:drawing || props.selected,
    onViewportChange:()=>{},
    onChange:changed=>{
      if(drawing && changed.kind==="annotation_stroke") apply(applyPracticeValue(scene,p.id,"points",changed.data.points));
    },
    onVariable:(name,value)=>{
      const candidates=p.kind==="coordinate_canvas" ? [p,...scene.primitives.filter(child=>("canvasId" in child.data && child.data.canvasId===p.id) || plotCompanions(scene,p.id).some(item=>item.id===child.id))] : [p];
      const owner=candidates.find(item=>allowedPracticeFields(item,scene).some(f=>f.key===`var:${name}`));
      if(owner) {
        try {apply(applyPracticeValue(scene,owner.id,`var:${name}`,String(value)));} catch { /* Preserve the validated attempt. */ }
      }
    }}:props;
  return <Boundary resetKey={JSON.stringify([p,props.scope,scene.updatedAt])}>
    <PrimitiveBody {...bodyProps} />
    {props.practice && <PracticeFields p={p} scene={scene} onApply={apply}/>}
    {props.practice && p.kind==="coordinate_canvas" && scene.primitives.filter(child=>"canvasId" in child.data && child.data.canvasId===p.id).map(child=>
      <PracticeFields key={child.id} p={child} scene={scene} onApply={next=>props.onPracticeChange?.(next)}/>)}
  </Boundary>;
}
export type { Props as PrimitiveVisualProps, SceneVariable };
