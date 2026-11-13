import { isLearningObject } from "../../core/math-engine/learning-types";
import { LearningInspector } from "./LearningInspector";
import { readLearningData } from "./read-learning-data";
import { useState, type FormEvent } from "react";
import {
  fitObject,
  validateObject,
  type MathObject,
  type Shape,
} from "../../core/document-schema/document";
import { parseStudioOperation } from "../../core/math-engine/studio-operations";

function NumericField({ name, label, value, min, max }: { name: string; label: string; value: number; min: number; max: number }) {
  return <label>{label}<input type="number" name={name} defaultValue={value} min={min} max={max} step={1} required /></label>;
}

export function PropertiesInspector({
  object,
  onApply,
}: {
  object: MathObject;
  onApply: (object: MathObject) => void;
}) {
  const [error, setError] = useState("");
  const multiplication = object.type === "operation" && parseStudioOperation(object.data.expression).operator === "×";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const read = (key: string) => {
      const value = fields.get(key);
      return typeof value === "string" ? value : "";
    };
    const num = (key: string) => Number(read(key));
    const numbers = (key: string) => read(key).trim() ? read(key).trim().split(/[,\s]+/).map(Number) : [];
    let next = fitObject({
      ...object,
      label: read("label"),
      x: num("x"),
      y: num("y"),
      width: num("width"),
      height: num("height"),
    });
    try {
      if (isLearningObject(object)) next = { ...next, ...readLearningData(object, fields) };
      else switch (object.type) {
        case "polygon": {
          const vertices = read("vertices").trim().split(";").map(pair => { const xy = pair.trim().split(/[,\s]+/); if (xy.length !== 2 || xy.some(x => !x.trim())) throw new Error("Escribe x,y; x,y con dos números por vértice."); return { x: Number(xy[0]), y: Number(xy[1]) }; });
          next = { ...next, type: "polygon", data: { ...object.data, vertices } }; break;
        }
        case "factorization": next = { ...next, type: "factorization", data: { number: num("factorNumber") } }; break;
        case "geometry":
          next = { ...next, type: "geometry", data: { ...object.data, figure: read("figure") as "rectangle" | "triangle", base: num("base"), height: num("geometryHeight") } };
          break;
        case "collection":
          next = { ...next, type: "collection", data: { values: numbers("values") } };
          break;
        case "number-line":
          next = { ...next, type: "number-line", data: { min: num("min"), max: num("max"), step: num("step"), points: numbers("points") } };
          break;
        case "linear-equation":
          next = { ...next, type: "linear-equation", data: { a: num("a"), b: num("b"), c: num("c"), d: num("d"), stage: num("stage") } };
          break;
        case "fraction":
          next = {
            ...object,
            ...next,
            type: "fraction",
            data: {
              numerator: num("numerator"),
              denominator: num("denominator"),
              shape: read("shape") as Shape,
            },
          };
          break;
        case "operation": {
          const expression = read("expression");
          parseStudioOperation(expression);
          next = {
            ...object,
            ...next,
            type: "operation",
            data: {
              expression,
              stage: num("stage"),
              shape: read("shape") as Shape,
            },
          };
          break;
        }
        case "text":
          next = {
            ...object,
            ...next,
            type: "text",
            data: { content: read("content"), fontSize: num("fontSize") },
          };
          break;
        case "sequence":
          next = {
            ...object,
            ...next,
            type: "sequence",
            data: {
              start: num("start"),
              difference: num("difference"),
              count: num("count"),
            },
          };
          break;
      }
      if (!validateObject(next))
        throw new Error(
          "Revisa los valores y los límites indicados para este objeto.",
        );
      onApply(next);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo aplicar el cambio.",
      );
    }
  }
  return (
    <form className="st-properties" onSubmit={submit}>
      <label>
        Nombre del objeto
        <input name="label" defaultValue={object.label} maxLength={120} />
      </label>
      {isLearningObject(object) && <LearningInspector object={object} onResimulate={() => { if (object.type === "probability") onApply({ ...object, data: { ...object.data, seed: object.data.seed * 48271 % 2147483647 } }); }} />}
      {object.type === "polygon" && <><label>Vértices en orden<textarea name="vertices" rows={4} required maxLength={160} defaultValue={object.data.vertices.map(p => `${p.x},${p.y}`).join("; ")} /></label><small>De 3 a 8 puntos x,y separados por punto y coma; enteros de 0 a 20. Los lados no deben cruzarse.</small></>}
      {object.type === "factorization" && <NumericField name="factorNumber" label="Número a descomponer" value={object.data.number} min={2} max={360} />}
      {object.type === "geometry" && <>
        <label>Figura<select name="figure" defaultValue={object.data.figure}><option value="rectangle">Rectángulo</option><option value="triangle">Triángulo rectángulo</option></select></label>
        <NumericField name="base" label="Base (unidades)" value={object.data.base} min={1} max={100} />
        <NumericField name="geometryHeight" label="Altura perpendicular (unidades)" value={object.data.height} min={1} max={100} />
      </>}
      {object.type === "collection" && <><label>Enteros de la colección<input name="values" aria-describedby="st-collection-hint" defaultValue={object.data.values.join(", ")} maxLength={180} required /></label><small id="st-collection-hint">De 1 a 24 enteros entre −1000 y 1000, separados por comas.</small></>}
      {object.type === "number-line" && <>
        <div className="st-field-pair"><NumericField name="min" label="Mínimo de la recta" value={object.data.min} min={-100} max={100} /><NumericField name="max" label="Máximo de la recta" value={object.data.max} min={-100} max={100} /></div>
        <NumericField name="step" label="Tamaño del paso" value={object.data.step} min={1} max={50} />
        <label>Puntos enteros<input name="points" aria-describedby="st-line-hint" defaultValue={object.data.points.join(", ")} maxLength={100} /></label><small id="st-line-hint">Hasta 12 puntos distintos dentro del rango. Rango divisible por el paso; hasta 40 marcas.</small>
      </>}
      {object.type === "linear-equation" && <>
        <small>ax + b = cx + d · coeficientes enteros de −1000 a 1000; dominio real.</small>
        <div className="st-field-pair">{(["a", "b", "c", "d"] as const).map(name => <NumericField key={name} name={name} label={`Coeficiente ${name}`} value={object.data[name]} min={-1000} max={1000} />)}</div>
        <label>Etapa de la ecuación<select name="stage" defaultValue={object.data.stage}><option value={0}>Igualdad original</option><option value={1}>Agrupar términos</option><option value={2}>Comprobar</option></select></label>
      </>}
      {object.type === "fraction" && (
        <div className="st-field-pair">
          <label>
            Numerador
            <input
              name="numerator"
              type="number"
              min={0}
              max={72}
              step={1}
              required
              defaultValue={object.data.numerator}
            />
          </label>
          <label>
            Denominador
            <input
              name="denominator"
              type="number"
              min={1}
              max={24}
              step={1}
              required
              defaultValue={object.data.denominator}
            />
          </label>
        </div>
      )}
      {object.type === "operation" && (
        <>
          <label>
            Operación
            <input
              name="expression"
              required
              maxLength={100}
              defaultValue={object.data.expression}
            />
          </label>
          <small>
            Dos fracciones no negativas, de hasta 3 unidades y denominador 1–24.
            Suma, resta o multiplicación (×). En suma/resta: resultado ≥ 0 y m.c.m. ≤ 60.
          </small>
          <label>
            Paso
            <select name="stage" defaultValue={object.data.stage}>
              <option value={0}>1 · Representar</option>
              <option value={1}>{multiplication ? "2 · Multiplicar factores" : "2 · Homogeneizar"}</option>
              <option value={2}>3 · Resolver</option>
            </select>
          </label>
        </>
      )}
      {(object.type === "fraction" || object.type === "operation") && (
        <label>
          Representación
          <select name="shape" defaultValue={object.data.shape}>
            <option value="bar">Barras</option>
            <option value="circle">Círculos</option>
          </select>
        </label>
      )}
      {object.type === "text" && (
        <>
          <label>
            Contenido
            <textarea
              name="content"
              rows={8}
              maxLength={5000}
              defaultValue={object.data.content}
            />
          </label>
          <label>
            Tamaño de letra
            <input
              name="fontSize"
              type="number"
              min={14}
              max={48}
              step={1}
              required
              defaultValue={object.data.fontSize}
            />
          </label>
        </>
      )}
      {object.type === "sequence" && (
        <>
          <label>
            Primer término
            <input
              name="start"
              type="number"
              min={-1000}
              max={1000}
              step={1}
              required
              defaultValue={object.data.start}
            />
          </label>
          <label>
            Diferencia entre términos
            <input
              name="difference"
              type="number"
              min={-100}
              max={100}
              step={1}
              required
              defaultValue={object.data.difference}
            />
          </label>
          <label>
            Cantidad de términos
            <input
              name="count"
              type="number"
              min={2}
              max={8}
              step={1}
              required
              defaultValue={object.data.count}
            />
          </label>
        </>
      )}
      <details>
        <summary>Posición y tamaño</summary>
        <div className="st-field-pair">
          <label>
            Posición X
            <input
              name="x"
              type="number"
              min={0}
              max={1600}
              required
              defaultValue={Math.round(object.x)}
            />
          </label>
          <label>
            Posición Y
            <input
              name="y"
              type="number"
              min={0}
              max={1000000}
              required
              defaultValue={Math.round(object.y)}
            />
          </label>
          <label>
            Ancho
            <input
              name="width"
              type="number"
              min={240}
              max={1600}
              required
              defaultValue={object.width}
            />
          </label>
          <label>
            Alto
            <input
              name="height"
              type="number"
              min={160}
              max={1100}
              required
              defaultValue={object.height}
            />
          </label>
        </div>
      </details>
      {error && (
        <p className="st-error" role="alert">
          {error}
        </p>
      )}
      <button className="st-primary" type="submit">
        Aplicar cambios
      </button>
    </form>
  );
}
