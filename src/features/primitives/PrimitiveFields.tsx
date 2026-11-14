import { useState } from "react";
import type { Primitive, PrimitiveScene } from "../../core/primitives/schema";
function Text(
  { label, value, onChange, type = "text" }: {
    label: string;
    value: string;
    onChange: (s: string) => void;
    type?: string;
  },
) {
  const [draft, setDraft] = useState(value),
    [focused, setFocused] = useState(false);
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type={type}
        value={focused ? draft : value}
        onFocus={() => {
          setFocused(true);
          setDraft(value);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        onBlur={() => {
          setFocused(false);
          setDraft(value);
        }}
      />
    </label>
  );
}
function NumberField(
  { label, value, onChange }: {
    label: string;
    value: number;
    onChange: (n: number) => void;
  },
) {
  return (
    <Text
      label={label}
      value={String(value)}
      type="number"
      onChange={(s) => {
        if (s.trim() && Number.isFinite(Number(s))) onChange(Number(s));
      }}
    />
  );
}
function Toggle(
  { label, value, onChange }: {
    label: string;
    value: boolean;
    onChange: (b: boolean) => void;
  },
) {
  return (
    <label className="pc-toggle">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
const optionLabels: Record<string, string> = {
  cartesian: "Cartesiano",
  polar: "Polar",
  unit_circle: "Círculo unidad",
  number_line: "Recta numérica",
  blank_grid: "Cuadrícula",
  rad: "Radianes",
  deg: "Grados",
  signed: "Integral con signo",
  geometric: "Área geométrica",
  none: "Ninguno",
  arrow: "Flecha",
  dot: "Punto",
  bar: "Marca / barras",
  apple: "Manzanas",
  star: "Estrellas",
  cube: "Cubos",
  coin: "Monedas",
  circle: "Círculos",
  atom: "Átomos",
  transparent: "Transparente",
  card: "Tarjeta",
  callout_info: "Nota informativa",
  callout_step: "Paso de explicación",
  slider: "Deslizador",
  stepper: "Incrementos",
  play_pause: "Animación",
  polygon: "Polígono",
  triangle: "Triángulo",
  circle_fraction: "Fracción circular",
  sector: "Sector circular",
  prism: "Prisma (diagrama)",
  cylinder: "Cilindro (diagrama)",
  inclined_plane: "Plano inclinado (diagrama)",
  block_mass: "Bloque (diagrama)",
  table_only: "Tabla",
  histogram: "Histograma",
  pie: "Circular",
  scatter: "Dispersión",
  freehand: "Dibujo libre",
  highlighter: "Resaltador",
  callout_bubble: "Nota",
};
function Select(
  { label, value, options, onChange }: {
    label: string;
    value: string;
    options: readonly string[];
    onChange: (s: string) => void;
  },
) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((v) => (
          <option key={v} value={v}>{optionLabels[v] ?? v}</option>
        ))}
      </select>
    </label>
  );
}
export function PrimitiveFields(
  { p, scene, onChange }: {
    p: Primitive;
    scene: PrimitiveScene;
    onChange: (p: Primitive) => void;
  },
) {
  const data = p.data;
  const patch = (change: Record<string, unknown>) =>
    onChange({ ...p, data: { ...data, ...change } } as Primitive);
  return (
    <div className="pc-fields" onPointerDown={(e) => e.stopPropagation()}>
      <div className="pc-field-row">
        {p.kind === "coordinate_canvas" && (
          <>
            <Select
              label="Tipo de plano"
              value={p.data.mode}
              options={[
                "cartesian",
                "polar",
                "unit_circle",
                "number_line",
                "blank_grid",
              ]}
              onChange={(mode) => patch({ mode })}
            />
            {(["domainX", "rangeY"] as const).map((key) => (
              <div className="pc-pair" key={key}>
                {p.data[key].map((v, i) => (
                  <Text
                    key={i}
                    label={`${key === "domainX" ? "x" : "y"} ${
                      i ? "máximo" : "mínimo"
                    }`}
                    value={v}
                    onChange={(value) =>
                      patch({
                        [key]: p.data[key].map((old, j) =>
                          j === i ? value : old
                        ),
                      })}
                  />
                ))}
              </div>
            ))}
            <Toggle
              label="Cuadrícula"
              value={p.data.showGrid}
              onChange={(showGrid) => patch({ showGrid })}
            />
            <Toggle
              label="Números de los ejes"
              value={p.data.showAxisLabels}
              onChange={(showAxisLabels) => patch({ showAxisLabels })}
            />
            <NumberField
              label="Divisiones del plano"
              value={p.data.subdivisions}
              onChange={(subdivisions) => patch({ subdivisions })}
            />
          </>
        )}
        {p.kind === "function_region" && (
          <>
            <Text
              label="Nombre de función"
              value={p.data.name}
              onChange={(name) => patch({ name })}
            />
            <Text
              label="Expresión de la función"
              value={p.data.expression}
              onChange={(expression) => patch({ expression })}
            />
            <Select
              label="Unidad angular"
              value={p.data.angleUnit}
              options={["rad", "deg"]}
              onChange={(angleUnit) => patch({ angleUnit })}
            />
            <Toggle
              label="Mostrar derivada"
              value={p.data.showDerivative}
              onChange={(showDerivative) => patch({ showDerivative })}
            />
            <Toggle
              label="Mostrar tangente"
              value={p.data.showTangent}
              onChange={(showTangent) => patch({ showTangent })}
            />
            <Text
              label="Tangente en x"
              value={p.data.tangentAt}
              onChange={(tangentAt) => patch({ tangentAt })}
            />
            <Toggle
              label="Sombrear y calcular área"
              value={p.data.showArea}
              onChange={(showArea) => patch({ showArea })}
            />
            {p.data.showArea && (
              <>
                <Text
                  label="Desde x"
                  value={p.data.fromExpr}
                  onChange={(fromExpr) => patch({ fromExpr })}
                />
                <Text
                  label="Hasta x"
                  value={p.data.toExpr}
                  onChange={(toExpr) => patch({ toExpr })}
                />
                <Text
                  label="Segunda curva (opcional)"
                  value={p.data.secondaryExpression}
                  onChange={(secondaryExpression) =>
                    patch({ secondaryExpression })}
                />
                <Select
                  label="Cálculo de la región"
                  value={p.data.areaMode}
                  options={["signed", "geometric"]}
                  onChange={(areaMode) => patch({ areaMode })}
                />
                <Text
                  label="Variable del resultado"
                  value={p.data.resultName}
                  onChange={(resultName) => patch({ resultName })}
                />
              </>
            )}
            <Text
              label="Puntos de la curva (separados por ; )"
              value={p.data.pointXs.join("; ")}
              onChange={(v) =>
                patch({
                  pointXs: v.split(";").map((s) => s.trim()).filter(Boolean),
                })}
            />
          </>
        )}
        {p.kind === "vector_segment" && (
          <>
            {(["start", "end"] as const).map((key) => (
              <div className="pc-pair" key={key}>
                {p.data[key].map((v, i) => (
                  <Text
                    key={i}
                    label={`${key === "start" ? "Inicio" : "Final"} ${
                      i ? "y" : "x"
                    }`}
                    value={v}
                    onChange={(value) =>
                      patch({
                        [key]: p.data[key].map((old, j) =>
                          j === i ? value : old
                        ),
                      })}
                  />
                ))}
              </div>
            ))}
            <Select
              label="Extremo inicial"
              value={p.data.headStart}
              options={["none", "arrow", "dot", "bar"]}
              onChange={(headStart) => patch({ headStart })}
            />
            <Select
              label="Extremo final"
              value={p.data.headEnd}
              options={["none", "arrow", "dot", "bar"]}
              onChange={(headEnd) => patch({ headEnd })}
            />
            <Toggle
              label="Mostrar magnitud"
              value={p.data.showMagnitude}
              onChange={(showMagnitude) => patch({ showMagnitude })}
            />
            <Toggle
              label="Mostrar ángulo"
              value={p.data.showAngleArc}
              onChange={(showAngleArc) => patch({ showAngleArc })}
            />
            <label>
              Plano<select
                value={p.data.canvasId ?? ""}
                onChange={(e) => patch({ canvasId: e.target.value || null })}
              >
                <option value="">Libre (píxeles)</option>
                {scene.primitives.filter((n) => n.kind === "coordinate_canvas")
                  .map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
              </select>
            </label>
          </>
        )}
        {p.kind === "stamp_grid" && (
          <>
            <Select
              label="Pictograma"
              value={p.data.icon}
              options={["apple", "star", "cube", "coin", "circle", "atom"]}
              onChange={(icon) => patch({ icon })}
            />
            <Text
              label="Filas"
              value={p.data.rowsExpr}
              onChange={(rowsExpr) => patch({ rowsExpr })}
            />
            <Text
              label="Columnas"
              value={p.data.colsExpr}
              onChange={(colsExpr) => patch({ colsExpr })}
            />
            <Text
              label="Elementos activos"
              value={p.data.activeCountExpr}
              onChange={(activeCountExpr) => patch({ activeCountExpr })}
            />
            <NumberField
              label="Agrupar cada"
              value={p.data.groupBy}
              onChange={(groupBy) => patch({ groupBy })}
            />
          </>
        )}
        {p.kind === "math_block" && (
          <>
            <Select
              label="Estilo del texto"
              value={p.data.variant}
              options={["transparent", "card", "callout_info", "callout_step"]}
              onChange={(variant) => patch({ variant })}
            />
            <span>
              Usa $LaTeX$ y variables como {"{{a}}"} o {"{{round(area,2)}}"}.
            </span>
          </>
        )}
        {p.kind === "control_slider" && (
          <>
            <Select
              label="Variable del control"
              value={p.data.variableName}
              options={scene.variables.map((v) => v.name)}
              onChange={(variableName) => patch({ variableName })}
            />
            <Select
              label="Tipo de control"
              value={p.data.controlType}
              options={["slider", "stepper", "play_pause"]}
              onChange={(controlType) => patch({ controlType })}
            />
            <NumberField
              label="Velocidad"
              value={p.data.speed}
              onChange={(speed) => patch({ speed })}
            />
          </>
        )}
        {p.kind === "geometric_shape" && (
          <>
            <Select
              label="Figura"
              value={p.data.shape}
              options={[
                "polygon",
                "triangle",
                "circle_fraction",
                "sector",
                "prism",
                "cylinder",
                "inclined_plane",
                "block_mass",
              ]}
              onChange={(shape) => patch({ shape })}
            />
            <Select
              label="Unidad"
              value={p.data.unit}
              options={["u", "mm", "cm", "m", "km"]}
              onChange={(unit) => patch({ unit })}
            />
            {["circle_fraction", "sector"].includes(p.data.shape)
              ? (
                <>
                  <NumberField
                    label="Partes iguales"
                    value={p.data.divisions}
                    onChange={(divisions) => patch({ divisions })}
                  />
                  <Text
                    label="Porciones coloreadas"
                    value={p.data.shadedExpr}
                    onChange={(shadedExpr) => patch({ shadedExpr })}
                  />
                  <Text
                    label="Radio"
                    value={p.data.radiusExpr}
                    onChange={(radiusExpr) => patch({ radiusExpr })}
                  />
                </>
              )
              : (
                <>
                  <Toggle
                    label="Figura regular"
                    value={p.data.regular}
                    onChange={(regular) => patch({ regular })}
                  />
                  {p.data.regular
                    ? (
                      <>
                        <NumberField
                          label="Número de lados"
                          value={p.data.sides}
                          onChange={(sides) => patch({ sides })}
                        />
                        <Text
                          label="Medida de cada lado"
                          value={p.data.sideExpr}
                          onChange={(sideExpr) => patch({ sideExpr })}
                        />
                      </>
                    )
                    : (
                      <Text
                        label="Vértices x,y (separados por ; )"
                        value={p.data.verticesExpr.map((pair) => pair.join(","))
                          .join("; ")}
                        onChange={(v) => {
                          const pairs = v.split(";").map((pair) =>
                            pair.split(",").map((s) => s.trim())
                          );
                          patch({ verticesExpr: pairs });
                        }}
                      />
                    )}
                  <Toggle
                    label="Medidas de lados"
                    value={p.data.showSideLengths}
                    onChange={(showSideLengths) => patch({ showSideLengths })}
                  />
                  <Toggle
                    label="Ángulos interiores"
                    value={p.data.showAngles}
                    onChange={(showAngles) => patch({ showAngles })}
                  />
                </>
              )}
          </>
        )}
        {p.kind === "data_chart" && (
          <>
            <Select
              label="Tipo de gráfico"
              value={p.data.chartType}
              options={["table_only", "bar", "histogram", "pie", "scatter"]}
              onChange={(chartType) => patch({ chartType })}
            />
            <Toggle
              label="Regresión lineal"
              value={p.data.showLinearRegression}
              onChange={(showLinearRegression) =>
                patch({ showLinearRegression })}
            />
            <Text
              label="Datos: etiqueta | x | valor (separados por ; )"
              value={p.data.rows.map((r) =>
                `${r.label} | ${r.xExpr} | ${r.valueExpr}`
              ).join("; ")}
              onChange={(v) =>
                patch({
                  rows: v.split(";").map((line) => {
                    const [label, xExpr, valueExpr] = line.split("|").map((s) =>
                      s.trim()
                    );
                    return { label, xExpr, valueExpr };
                  }),
                })}
            />
          </>
        )}
        {p.kind === "annotation_stroke" && (
          <>
            <Select
              label="Tipo de anotación"
              value={p.data.mode}
              options={["freehand", "highlighter", "callout_bubble"]}
              onChange={(mode) => patch({ mode })}
            />
            {p.data.mode === "callout_bubble"
              ? (
                <Text
                  label="Texto de la nota"
                  value={p.data.calloutText}
                  onChange={(calloutText) => patch({ calloutText })}
                />
              )
              : (
                <button onClick={() => patch({ points: [] })}>
                  Limpiar trazo
                </button>
              )}
          </>
        )}
      </div>
    </div>
  );
}
