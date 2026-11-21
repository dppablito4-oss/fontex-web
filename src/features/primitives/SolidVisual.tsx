import { type PointerEvent, useRef, useState } from "react";
import type { PrimitiveVisualProps } from "./PrimitiveVisual";
import type { Primitive } from "../../core/primitives/schema";
import { displayNumber as num } from "../../core/primitives/math";
import {
  type Camera3D,
  defaultCamera,
  orbitCamera,
  projectSolid,
  solidDimensions,
  solidLabels,
  solidMesh,
  solidMetrics,
} from "../../core/primitives/solid-geometry";
import { diagramColor } from "./visual-colors";

function shadeColor(hex: string, shade: number) {
  return "#" +
    [1, 3, 5].map((i) =>
      Math.round(Number.parseInt(hex.slice(i, i + 2), 16) * shade).toString(16)
        .padStart(2, "0")
    ).join("");
}
export function SolidVisual(
  { p, scope, functions, onChange, readOnly }: PrimitiveVisualProps & {
    p: Extract<Primitive, { kind: "solid_3d" }>;
  },
) {
  const dimensions = solidDimensions(p.data, scope, functions);
  const mesh = solidMesh(p.data.solid, dimensions);
  const key = p.id + JSON.stringify(p.data.camera);
  const [view, setView] = useState({ key, camera: p.data.camera });
  const camera = view.key === key ? view.camera : p.data.camera;
  const drag = useRef<
    | { id: number; x: number; y: number; before: Camera3D; next: Camera3D }
    | null
  >(null);
  const faces = projectSolid(mesh, camera),
    metrics = solidMetrics(p.data.solid, dimensions);
  const name = solidLabels[p.data.solid], unit = p.data.unit;
  const change = (next: Camera3D, persist = true) => {
    setView({ key, camera: next });
    if (persist && !readOnly) {
      onChange({ ...p, data: { ...p.data, camera: next } });
    }
  };
  const finish = (e: PointerEvent<SVGSVGElement>, persist: boolean) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const next = drag.current.next;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    change(next, persist);
  };
  return (
    <div
      className="pc-solid"
      data-solid={p.data.solid}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label={`Explorador 3D: ${name}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-10, 0],
          ArrowRight: [10, 0],
          ArrowUp: [0, -10],
          ArrowDown: [0, 10],
        };
        if (moves[e.key]) {
          e.preventDefault();
          e.stopPropagation();
          change(orbitCamera(camera, ...moves[e.key]!));
        } else if (e.key === "+" || e.key === "-") {
          e.preventDefault();
          e.stopPropagation();
          change({
            ...camera,
            zoom: Math.max(
              .4,
              Math.min(2.5, camera.zoom + (e.key === "+" ? .15 : -.15)),
            ),
          });
        }
      }}
    >
      <svg
        viewBox="0 0 800 460"
        role="img"
        aria-label={`${name} en 3D`}
        data-camera={`${camera.yaw},${camera.pitch},${camera.zoom}`}
        onPointerDown={(e) => {
          if (e.button !== 0 || drag.current) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            before: camera,
            next: camera,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          d.next = orbitCamera(
            d.before,
            (e.clientX - d.x) * .5,
            (e.clientY - d.y) * .5,
          );
          change(d.next, false);
        }}
        onPointerUp={(e) => finish(e, true)}
        onPointerCancel={(e) => finish(e, false)}
        onLostPointerCapture={(e) => {
          if (drag.current?.id === e.pointerId) finish(e, false);
        }}
      >
        <title>{name}: arrastra para girar el cuerpo</title>
        {faces.map((face) => {
          const fill = shadeColor(p.style.fillColor, face.shade);
          return (
            <polygon
              key={face.index}
              data-face={face.index}
              points={face.points.map(([x, y]) =>
                `${x.toFixed(3)},${y.toFixed(3)}`
              ).join(" ")}
              fill={fill}
              stroke={p.data.showEdges
                ? diagramColor(p.style.strokeColor)
                : fill}
              strokeWidth={p.data.showEdges
                ? Math.max(.6, p.style.strokeWidth * .6)
                : .6}
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
      <div className="pc-solid-controls" aria-label="Vista del cuerpo 3D">
        <button
          type="button"
          aria-label="Girar a la izquierda"
          onClick={() => change(orbitCamera(camera, -15, 0))}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label="Girar a la derecha"
          onClick={() => change(orbitCamera(camera, 15, 0))}
        >
          ↷
        </button>
        <button
          type="button"
          aria-label="Acercar cuerpo 3D"
          disabled={camera.zoom >= 2.5}
          onClick={() =>
            change({ ...camera, zoom: Math.min(2.5, camera.zoom + .2) })}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Alejar cuerpo 3D"
          disabled={camera.zoom <= .4}
          onClick={() =>
            change({ ...camera, zoom: Math.max(.4, camera.zoom - .2) })}
        >
          −
        </button>
        <button type="button" onClick={() => change({ ...defaultCamera })}>
          Restablecer vista
        </button>
      </div>
      <p className="pc-solid-hint">
        Arrastra para girar · Flechas para orientar · + / − para acercar
      </p>
      {p.data.showMeasures && (
        <div className="pc-solid-measures" aria-label="Medidas del cuerpo 3D">
          <span>
            {["sphere", "cylinder", "cone"].includes(p.data.solid)
              ? `Radio: ${num(dimensions.radius)} ${unit}`
              : `${p.data.solid === "cube" ? "Arista" : "Ancho"}: ${
                num(dimensions.width)
              } ${unit}`}
          </span>
          {!["cube", "sphere"].includes(p.data.solid) && (
            <span>Altura: {num(dimensions.height)} {unit}</span>
          )}
          {["pyramid", "cuboid"].includes(p.data.solid) && (
            <span>Profundidad: {num(dimensions.depth)} {unit}</span>
          )}
          <strong>Área total: {num(metrics.area)} {unit}²</strong>
          <strong>Volumen: {num(metrics.volume)} {unit}³</strong>
        </div>
      )}
    </div>
  );
}
