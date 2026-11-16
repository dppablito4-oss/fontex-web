import { useState } from "react";
import type { Primitive, PrimitiveScene } from "../../core/primitives/schema";
import type { GraphEdge, GraphNode } from "../../core/primitives/logic";
import { NumberField, Select, Text, Toggle } from "./FieldControls";
type Props = {
  p: Primitive;
  scene: PrimitiveScene;
  onChange: (p: Primitive) => void;
};
function GraphEditor(
  { p, scene, onChange }: Props & {
    p: Extract<Primitive, { kind: "node_graph" }>;
  },
) {
  const [graphType, setType] = useState(p.data.graphType),
    [nodes, setNodes] = useState<GraphNode[]>(p.data.nodes),
    [edges, setEdges] = useState<GraphEdge[]>(p.data.edges);
  const booleanNames = scene.variables.filter((v) =>
    v.min === 0 && v.max === 1 && v.step === 1
  ).map((v) => v.name);
  const change = (id: string, patch: Partial<GraphNode>) =>
    setNodes(nodes.map((n) => n.id === id ? { ...n, ...patch } : n));
  return (
    <div className="pc-graph-editor">
      <Select
        label="Tipo de diagrama"
        value={graphType}
        options={["relations", "logic"]}
        onChange={(v) => setType(v as "relations" | "logic")}
      />
      {nodes.map((node, i) => (
        <fieldset key={node.id}>
          <legend>Nodo {i + 1}</legend>
          <div className="pc-field-row">
            <Text
              label={`Nombre del nodo ${i + 1}`}
              value={node.label}
              onChange={(label) => change(node.id, { label })}
            />
            <Select
              label={`Tipo del nodo ${i + 1}`}
              value={node.type}
              options={graphType === "logic"
                ? ["input", "and", "or", "not", "output"]
                : ["relation"]}
              onChange={(type) =>
                change(node.id, { type: type as GraphNode["type"] })}
            />
            <Text label={`Fórmula del nodo ${i + 1}`} value={node.formula ?? ""} onChange={formula => change(node.id, { formula })} />
            {graphType === "logic" && node.type === "input" && (
              <Select
                label={`Proposición del nodo ${i + 1}`}
                value={node.variableName ?? ""}
                options={["", ...booleanNames]}
                onChange={(variableName) =>
                  change(node.id, { variableName: variableName || null })}
              />
            )}
            <NumberField
              label={`Horizontal del nodo ${i + 1}`}
              value={node.x}
              onChange={(x) => change(node.id, { x })}
            />
            <NumberField
              label={`Vertical del nodo ${i + 1}`}
              value={node.y}
              onChange={(y) => change(node.id, { y })}
            />
            <button
              onClick={() => {
                setNodes(nodes.filter((n) => n.id !== node.id));
                setEdges(
                  edges.filter((e) => e.from !== node.id && e.to !== node.id),
                );
              }}
            >
              Quitar nodo {i + 1}
            </button>
          </div>
        </fieldset>
      ))}
      <button
        disabled={nodes.length >= 32}
        onClick={() =>
          setNodes([...nodes, {
            id: crypto.randomUUID(),
            label: `Nodo ${nodes.length + 1}`,
            type: graphType === "logic" ? "input" : "relation",
            variableName: graphType === "logic"
              ? (booleanNames[0] ?? null)
              : null,
            x: 80 + nodes.length % 4 * 210,
            y: 80 + Math.floor(nodes.length / 4) % 4 * 140,
          }])}
      >
        Añadir nodo
      </button>
      {edges.map((edge, i) => (
        <div className="pc-field-row" key={i}>
          <label>
            Origen {i + 1}
            <select
              value={edge.from}
              onChange={(e) =>
                setEdges(
                  edges.map((v, j) =>
                    i === j ? { ...v, from: e.target.value } : v
                  ),
                )}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </label>
          <label>
            Destino {i + 1}
            <select
              value={edge.to}
              onChange={(e) =>
                setEdges(
                  edges.map((v, j) =>
                    i === j ? { ...v, to: e.target.value } : v
                  ),
                )}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </label>
          <Text
            label={`Etiqueta de conexión ${i + 1}`}
            value={edge.label}
            onChange={(label) =>
              setEdges(edges.map((v, j) => i === j ? { ...v, label } : v))}
          />
          <button onClick={() => setEdges(edges.filter((_, j) => i !== j))}>
            Quitar conexión {i + 1}
          </button>
        </div>
      ))}
      <button
        disabled={edges.length >= 64 || nodes.length < 2}
        onClick={() => setEdges([...edges, {
          from: nodes[0]!.id,
          to: nodes[1]!.id,
          label: "",
        }])}
      >
        Añadir conexión
      </button>
      <button
        className="pc-primary"
        onClick={() => onChange({ ...p, data: { graphType, nodes, edges } })}
      >
        Aplicar diagrama
      </button>
      <small>
        AND/OR necesitan 2–4 entradas; NOT y salida, una. Las entradas usan
        variables 0/1. Todos los cambios se validan juntos.
      </small>
    </div>
  );
}
export function AdvancedFields({ p, scene, onChange }: Props) {
  const patch = (data: Record<string, unknown>) =>
    onChange({ ...p, data: { ...p.data, ...data } } as Primitive);
  const transforms = scene.primitives.filter((n) =>
    n.kind === "data_chart" && n.data.chartType === "matrix" &&
    n.data.matrixCells?.length === 2
  );
  return (
    <>
      {p.kind === "function_region" && (
        <>
          <Select
            label="Tipo de curva"
            value={p.data.curveMode ?? "cartesian"}
            options={["cartesian", "parametric", "polar"]}
            onChange={(curveMode) =>
              patch({
                curveMode,
                ...(curveMode !== "cartesian"
                  ? {
                    showArea: false,
                    showDerivative: false,
                    showTangent: false,
                    xExpr: p.data.xExpr ?? "cos(t)",
                    yExpr: p.data.yExpr ?? "sin(t)",
                    rExpr: p.data.rExpr ?? "1",
                    parameterFromExpr: p.data.parameterFromExpr ?? "0",
                    parameterToExpr: p.data.parameterToExpr ?? "2*pi",
                  }
                  : {}),
              })}
          />
          {p.data.curveMode && p.data.curveMode !== "cartesian" && (
            <>
              {(p.data.curveMode === "parametric"
                ? [["xExpr", "x(t)"], ["yExpr", "y(t)"]]
                : [["rExpr", "r(θ)"]]).map(([key, label]) => (
                  <Text
                    key={key}
                    label={label!}
                    value={String(
                      p.data[key as "xExpr" | "yExpr" | "rExpr"] ?? "",
                    )}
                    onChange={(v) => patch({ [key!]: v })}
                  />
                ))}
              <Select
                label="Unidad angular de la curva"
                value={p.data.angleUnit}
                options={["rad", "deg"]}
                onChange={(angleUnit) => patch({ angleUnit })}
              />
              <Text
                label="Parámetro desde"
                value={p.data.parameterFromExpr ?? "0"}
                onChange={(parameterFromExpr) => patch({ parameterFromExpr })}
              />
              <Text
                label="Parámetro hasta"
                value={p.data.parameterToExpr ?? "2*pi"}
                onChange={(parameterToExpr) => patch({ parameterToExpr })}
              />
              <Text
                label="Posición del punto móvil (opcional)"
                value={p.data.parameterValueExpr ?? ""}
                onChange={(v) => patch({ parameterValueExpr: v || null })}
              />
            </>
          )}
        </>
      )}
      {((p.kind === "geometric_shape" && p.data.shape.startsWith("venn")) ||
        (p.kind === "data_chart" && p.data.chartType === "truth_table")) && (
        <>
          <Text
            label="Proposiciones (separadas por coma)"
            value={(p.data.logicVariables ??
              (p.kind === "geometric_shape" && p.data.shape === "venn_3"
                ? ["p", "q", "r"]
                : ["p", "q"])).join(", ")}
            onChange={(v) =>
              patch({ logicVariables: v.split(",").map((n) => n.trim()) })}
          />
          <Text
            label="Expresión lógica"
            value={p.data.logicExpression ?? "p && q"}
            onChange={(logicExpression) => patch({ logicExpression })}
          />
          {p.kind === "geometric_shape" && (
            <Text
              label="Nombres de los conjuntos"
              value={(p.data.setLabels ??
                (p.data.shape === "venn_3" ? ["A", "B", "C"] : ["A", "B"]))
                .join(", ")}
              onChange={(v) =>
                patch({ setLabels: v.split(",").map((n) => n.trim()) })}
            />
          )}
          <small>
            ! negación · && y · || o · -&gt; implica · &lt;-&gt; equivale.
          </small>
        </>
      )}
      {p.kind === "data_chart" && p.data.chartType === "matrix" && (
        <div className="pc-matrix-fields">
          <Text
            label="Nombre de matriz"
            value={p.data.matrixName ?? "m"}
            onChange={(matrixName) => patch({ matrixName })}
          />
          <Select
            label="Tamaño de matriz"
            value={String(p.data.matrixCells?.length ?? 2)}
            options={["2", "3"]}
            onChange={(n) =>
              patch({
                matrixCells: Array.from({ length: Number(n) }, (_, i) =>
                  Array.from(
                    { length: Number(n) },
                    (_, j) =>
                      p.data.matrixCells?.[i]?.[j] ?? String(Number(i === j)),
                  )),
              })}
          />
          <div
            className="pc-matrix-grid"
            style={{
              gridTemplateColumns: `repeat(${
                p.data.matrixCells?.length ?? 2
              }, minmax(70px,1fr))`,
            }}
          >
            {p.data.matrixCells?.flatMap((row, i) =>
              row.map((cell, j) => (
                <Text
                  key={`${i}-${j}`}
                  label={`Celda ${i + 1},${j + 1}`}
                  value={cell}
                  onChange={(value) =>
                    patch({
                      matrixCells: p.data.matrixCells!.map((old, r) =>
                        old.map((v, c) => r === i && c === j ? value : v)
                      ),
                    })}
                />
              ))
            )}
          </div>
          <Toggle
            label="Mostrar matriz inversa"
            value={p.data.showInverse !== false}
            onChange={(showInverse) => patch({ showInverse })}
          />
        </div>
      )}
      {(p.kind === "vector_segment" ||
        (p.kind === "geometric_shape" &&
          ["polygon", "triangle"].includes(p.data.shape))) && (
        <>
          <label>
            Transformación del plano<select
              value={p.data.transformMatrixId ?? ""}
              onChange={(e) =>
                patch({ transformMatrixId: e.target.value || null })}
            >
              <option value="">Sin transformación</option>
              {transforms.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.kind === "data_chart" ? m.data.matrixName : ""}
                </option>
              ))}
            </select>
          </label>
          {p.data.transformMatrixId && (
            <Toggle
              label="Aplicar la inversa"
              value={p.data.transformInverse ?? false}
              onChange={(transformInverse) => patch({ transformInverse })}
            />
          )}
        </>
      )}
      {p.kind === "node_graph" && (
        <GraphEditor
          key={`${p.id}:${JSON.stringify(p.data)}`}
          p={p}
          scene={scene}
          onChange={onChange}
        />
      )}
    </>
  );
}
