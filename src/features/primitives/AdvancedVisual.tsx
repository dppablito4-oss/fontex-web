import { useId } from "react";
import { diagramColor } from "./visual-colors";
import type { PrimitiveVisualProps } from "./PrimitiveVisual";
import type { Primitive } from "../../core/primitives/schema";
import { displayNumber as num, scopeMatrix } from "../../core/primitives/math";
import {
  determinant,
  inverse,
  type Matrix,
} from "../../core/primitives/linear-algebra";
import { graphValues, truthTable } from "../../core/primitives/logic";
export function TruthMatrix(
  { p, scope }: PrimitiveVisualProps & {
    p: Extract<Primitive, { kind: "data_chart" }>;
  },
) {
  if (p.data.chartType === "matrix") {
    const name = p.data.matrixName!,
      matrix = scopeMatrix(scope, name),
      inverted = inverse(matrix);
    const table = (values: Matrix, label: string) => (
      <table className="pc-matrix" aria-label={label}>
        <tbody>
          {values.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j}>{num(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );
    return (
      <div className="pc-chart pc-matrix-view">
        <strong>Matriz {name}</strong>
        {table(matrix, `Matriz ${name}`)}
        <p>
          det({name}) = <strong>{num(determinant(matrix))}</strong>
        </p>
        {p.data.showInverse !== false && (
          <section>
            <strong>Inversa</strong>
            {inverted
              ? table(inverted, `Inversa de ${name}`)
              : (
                <p role="status">
                  Matriz singular: no tiene inversa numérica estable.
                </p>
              )}
          </section>
        )}
      </div>
    );
  }
  const variables = p.data.logicVariables ?? ["p", "q"],
    expression = p.data.logicExpression ?? "p && q";
  const rows = truthTable(expression, variables),
    hasCurrent = variables.every((n) =>
      Object.hasOwn(scope, n) && [0, 1].includes(scope[n]!)
    );
  return (
    <div className="pc-chart">
      <p>
        <strong>{expression}</strong> · 0 = falso · 1 = verdadero
      </p>
      <div className="pc-table-scroll pc-truth-table">
        <table aria-label="Tabla de verdad">
          <thead>
            <tr>
              {variables.map((n) => <th key={n}>{n}</th>)}
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const active = hasCurrent &&
                variables.every((n) => scope[n] === row.assignment[n]);
              return (
                <tr
                  key={i}
                  className={active ? "pc-truth-active" : ""}
                  aria-current={active ? "true" : undefined}
                >
                  {variables.map((n) => <td key={n}>{row.assignment[n]}</td>)}
                  <td>
                    <strong>{Number(row.result)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!hasCurrent && (
        <small>
          Añade interruptores con estos nombres para resaltar la combinación
          actual.
        </small>
      )}
    </div>
  );
}
export function Venn(
  { p, scope }: PrimitiveVisualProps & {
    p: Extract<Primitive, { kind: "geometric_shape" }>;
  },
) {
  const prefix = useId(), count = p.data.shape === "venn_3" ? 3 : 2;
  const variables = p.data.logicVariables ??
      (count === 3 ? ["p", "q", "r"] : ["p", "q"]),
    labels = p.data.setLabels ??
      variables.map((_, i) => String.fromCharCode(65 + i));
  const expression = p.data.logicExpression ?? "p && q",
    regions = truthTable(expression, variables);
  const circles = count === 3
    ? [{ x: 310, y: 215, r: 140 }, { x: 490, y: 215, r: 140 }, {
      x: 400,
      y: 360,
      r: 140,
    }]
    : [{ x: 300, y: 270, r: 170 }, { x: 500, y: 270, r: 170 }];
  const known = variables.every((v) =>
    Object.hasOwn(scope, v) && [0, 1].includes(scope[v]!)
  );
  let marker: { x: number; y: number; distance: number } | undefined;
  if (known) {
    for (let y = 45; y < 515; y += 12) {
      for (let x = 45; x < 755; x += 12) {
        if (
          circles.every((c, i) =>
            Number(Math.hypot(x - c.x, y - c.y) < c.r) === scope[variables[i]!]!
          )
        ) {
          const distance = Math.hypot(x - 400, y - 280);
          if (!marker || distance < marker.distance) {
            marker = { x, y, distance };
          }
        }
      }
    }
  }
  return (
    <div className="pc-venn">
      <p>
        <strong>{expression}</strong> ·{" "}
        {labels.map((label, i) => `${label} = ${variables[i]}`).join(" · ")}
      </p>
      <svg
        viewBox="0 0 800 550"
        role="img"
        aria-label={`Diagrama de Venn de ${count} conjuntos`}
      >
        <defs>
          {circles.map((c, i) => (
            <clipPath key={i} id={`${prefix}-circle-${i}`}>
              <circle cx={c.x} cy={c.y} r={c.r} />
            </clipPath>
          ))}
          {regions.map((region, i) => (
            <mask
              key={i}
              id={`${prefix}-mask-${i}`}
              maskUnits="userSpaceOnUse"
              x="15"
              y="15"
              width="770"
              height="520"
            >
              <rect x="15" y="15" width="770" height="520" fill="white" />
              {circles.map((c, j) =>
                !region.assignment[variables[j]!] && (
                  <circle key={j} cx={c.x} cy={c.y} r={c.r} fill="black" />
                )
              )}
            </mask>
          ))}
        </defs>
        <rect
          x="15"
          y="15"
          width="770"
          height="520"
          rx="8"
          fill="none"
          stroke="var(--pc-line)"
        />
        <text x="32" y="47" fill="currentColor" fontSize="22">U</text>
        {regions.map((region, i) => {
          if (!region.result) return null;
          let fill = (
            <rect
              x="15"
              y="15"
              width="770"
              height="520"
              fill={diagramColor(p.style.fillColor)}
              fillOpacity=".6"
              mask={`url(#${prefix}-mask-${i})`}
            />
          );
          circles.forEach((_, j) => {
            if (region.assignment[variables[j]!]) {
              fill = <g clipPath={`url(#${prefix}-circle-${j})`}>{fill}</g>;
            }
          });
          return <g key={i} data-venn-region={i}>{fill}</g>;
        })}
        {circles.map((c, i) => (
          <g key={i}>
            <circle
              cx={c.x}
              cy={c.y}
              r={c.r}
              fill="none"
              stroke={diagramColor(p.style.strokeColor)}
              strokeWidth="3"
            />
            <text
              x={c.x - 65}
              y={c.y - c.r + 35}
              fontSize="25"
              fill="currentColor"
            >
              {labels[i]}
            </text>
          </g>
        ))}
        {marker && (
          <circle
            className="pc-venn-current"
            cx={marker.x}
            cy={marker.y}
            r="9"
            fill="var(--pc-ink)"
            stroke="var(--pc-surface)"
            strokeWidth="3"
          />
        )}
      </svg>
      {known && (
        <p>
          Estado actual: {variables.map((v) => `${v}=${scope[v]}`).join(", ")}
          {" "}
          · Resultado:{" "}
          <strong>
            {Number(
              regions.find((row) =>
                variables.every((v) => row.assignment[v] === scope[v])
              )!.result,
            )}
          </strong>. El punto marca tu combinación.
        </p>
      )}
    </div>
  );
}
export function NodeGraph(
  { p, scope, onVariable }: PrimitiveVisualProps & {
    p: Extract<Primitive, { kind: "node_graph" }>;
  },
) {
  const marker = useId(),
    logic = p.data.graphType === "logic",
    values = logic ? graphValues(p.data.nodes, p.data.edges, scope) : {};
  const input = (id: string) => {
    const node = p.data.nodes.find((n) => n.id === id)!;
    if (node.type === "input" && node.variableName) {
      onVariable(node.variableName, Number(!values[id]));
    }
  };
  return (
    <div className="pc-node-graph">
      <svg
        viewBox="0 0 800 600"
        role="img"
        aria-label={logic
          ? "Circuito lógico interactivo"
          : "Diagrama de relaciones"}
      >
        <defs>
          <marker
            id={marker}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0L8,4L0,8Z" fill="context-stroke" />
          </marker>
        </defs>
        {p.data.edges.map((edge, i) => {
          const a = p.data.nodes.find((n) => n.id === edge.from)!,
            b = p.data.nodes.find((n) => n.id === edge.to)!,
            active = logic && values[a.id];
          return (
            <g key={i} data-edge-active={active ? "1" : "0"}>
              <path
                d={`M${a.x + 55},${a.y}C${(a.x + b.x) / 2},${a.y} ${
                  (a.x + b.x) / 2
                },${b.y} ${b.x - 55},${b.y}`}
                fill="none"
                stroke={active ? "var(--pc-accent)" : "var(--pc-muted)"}
                strokeWidth={active ? 4 : 2}
                markerEnd={`url(#${marker})`}
              />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 10}
                textAnchor="middle"
                fill="currentColor"
                fontSize="18"
              >
                {edge.label}
              </text>
            </g>
          );
        })}
        {p.data.nodes.map((node) => {
          const active = logic && values[node.id],
            interactive = logic && node.type === "input";
          return (
            <g
              key={node.id}
              data-node-id={node.id}
              data-state={logic ? Number(active) : undefined}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={interactive
                ? `Entrada ${node.variableName}`
                : undefined}
              aria-pressed={interactive ? active : undefined}
              onClick={(e) => {
                if (interactive) {
                  e.stopPropagation();
                  input(node.id);
                }
              }}
              onKeyDown={(e) => {
                if (interactive && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  e.stopPropagation();
                  input(node.id);
                }
              }}
              className={interactive ? "pc-logic-input" : ""}
            >
              <title>{node.label}</title>
              <rect
                x={node.x - 55}
                y={node.y - 30}
                width="110"
                height="60"
                rx={node.type === "output" ? 28 : 8}
                fill={active ? "var(--pc-accent)" : "var(--pc-surface)"}
                stroke={diagramColor(p.style.strokeColor)}
                strokeWidth="2"
              />
              <text
                x={node.x}
                y={node.y - 2}
                textAnchor="middle"
                fill={active ? "var(--pc-on)" : "var(--pc-ink)"}
                fontSize="18"
              >
                {node.label.slice(0, 15)}
              </text>
              {logic && (
                <text
                  x={node.x}
                  y={node.y + 20}
                  textAnchor="middle"
                  fill={active ? "var(--pc-on)" : "var(--pc-ink)"}
                  fontSize="17"
                >
                  {node.type === "input"
                    ? "Entrada"
                    : node.type === "output"
                    ? "Salida"
                    : node.type.toUpperCase()} · {Number(active)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {logic && (
        <p>
          0 = apagado · 1 = encendido. Pulsa una entrada o usa sus
          interruptores. AND representa conexión en serie; OR, en paralelo.
        </p>
      )}
    </div>
  );
}
