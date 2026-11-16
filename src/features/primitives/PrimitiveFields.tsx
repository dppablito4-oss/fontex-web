import {
  nextSymbol,
  type Primitive,
  type PrimitiveScene,
} from "../../core/primitives/schema";
import { NumberField, Select, Text, Toggle } from "./FieldControls";
import { AcademicMarkdown } from "../tutor/components/AcademicMarkdown";
import { interpolate, sceneScope, sceneFunctions } from "../../core/primitives/math";
import { PracticePermissions } from "./PracticeFields";
import { AdvancedFields } from "./AdvancedFields";
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
        {p.kind === "answer_field" && <>
          <label>Consigna<textarea aria-label="Consigna de respuesta" rows={3} value={p.data.prompt} onChange={e=>patch({prompt:e.target.value})} /></label>
          <Select label="Tipo de respuesta" value={p.data.answerType} options={["text","number","expression"]} onChange={answerType=>patch({answerType,answer:""})}/>
          <p>El alumno escribe sobre el lienzo. Esta respuesta se guarda para revisión; no se califica automáticamente.</p>
        </>}
        {p.kind === "coordinate_canvas" && (
          <>
            <Toggle label="Ajustar automáticamente a las figuras" value={p.data.autoFit ?? true}
              onChange={(autoFit) => patch({ autoFit, ...(autoFit && p.data.referenceWindow ? { ...p.data.referenceWindow, referenceWindow: null } : {}) })} />
            <Toggle
              label="Misma escala en ambos ejes"
              value={p.data.equalScale ?? true}
              onChange={(equalScale) => patch({ equalScale })}
            />
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
                        autoFit: false,
                        referenceWindow: null,
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
            {(!p.data.curveMode || p.data.curveMode === "cartesian") && (
              <>
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
                      pointXs: v.split(";").map((s) => s.trim()).filter(
                        Boolean,
                      ),
                    })}
                />
              </>
            )}
          </>
        )}
        {p.kind === "vector_segment" && (
          <>
            <label>
              Altura del salto en la recta
              <input
                type="number"
                min="0"
                max="120"
                step="5"
                value={p.data.arcHeight ?? 0}
                onChange={(e) => patch({ arcHeight: Number(e.target.value) })}
              />
              <small>0 dibuja un segmento recto.</small>
            </label>
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
            <label className="pc-text-editor">
              Texto y fórmula
              <textarea
                aria-label="Texto y fórmula"
                value={p.data.markdownContent}
                rows={8}
                onChange={(e) => patch({ markdownContent: e.target.value })}
              />
              <small>Escribe texto, Markdown y fórmulas entre $…$ o $$…$$.</small>
            </label>
            <div className="pc-text-preview" aria-label="Vista previa del texto">
              <AcademicMarkdown content={interpolate(p.data.markdownContent, sceneScope(scene), sceneFunctions(scene))} />
            </div>
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
              options={["slider", "stepper", "play_pause", "toggle"]}
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
                "venn_2",
                "venn_3",
              ]}
              onChange={(shape) =>
                patch({
                  shape,
                  ...(shape.startsWith("venn")
                    ? {
                      canvasId: null,
                      logicVariables: shape === "venn_3"
                        ? ["p", "q", "r"]
                        : ["p", "q"],
                      logicExpression: "p && q",
                      setLabels: shape === "venn_3"
                        ? ["A", "B", "C"]
                        : ["A", "B"],
                    }
                    : {}),
                })}
            />
            {!p.data.shape.startsWith("venn") && (
              <>
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
                            <Text label="Lados (expresión opcional)" value={p.data.sidesExpr ?? ""} onChange={sidesExpr => patch({ sidesExpr: sidesExpr || null })} />
                            <Text label="Rotación de vértices (grados)" value={p.data.rotationExpr ?? ""} onChange={rotationExpr => patch({ rotationExpr: rotationExpr || null })} />
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
                            value={p.data.verticesExpr.map((pair) =>
                              pair.join(",")
                            )
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
                        onChange={(showSideLengths) =>
                          patch({ showSideLengths })}
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
          </>
        )}
        {p.kind === "data_chart" && (
          <>
            <Select
              label="Tipo de gráfico"
              value={p.data.chartType}
              options={[
                "table_only",
                "bar",
                "histogram",
                "pie",
                "scatter",
                "line",
                "truth_table",
                "matrix",
              ]}
              onChange={(chartType) =>
                patch({
                  chartType,
                  ...(chartType === "matrix"
                    ? {
                      matrixName: nextSymbol(
                        scene,
                        p.data.matrixName ?? "m",
                        p.id,
                      ),
                      matrixCells: p.data.matrixCells ??
                        [["1", "0"], ["0", "1"]],
                      showInverse: true,
                    }
                    : {}),
                  ...(chartType === "truth_table"
                    ? { logicVariables: ["p", "q"], logicExpression: "p && q" }
                    : {}),
                })}
            />
            {!["matrix", "truth_table"].includes(p.data.chartType) && (
              <>
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
                        const [label, xExpr, valueExpr] = line.split("|").map((
                          s,
                        ) => s.trim());
                        return { label, xExpr, valueExpr };
                      }),
                    })}
                />
              </>
            )}
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
        <AdvancedFields p={p} scene={scene} onChange={onChange} />
      </div>
      <PracticePermissions p={p} scene={scene} onChange={onChange} />
    </div>
  );
}
