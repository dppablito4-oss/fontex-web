import { useState, type FormEvent } from "react";
import {
  fitObject,
  validateObject,
  type MathObject,
  type Shape,
} from "../../core/document-schema/document";
import { parseOperation } from "../../core/math-engine/fractions";

export function PropertiesInspector({
  object,
  onApply,
}: {
  object: MathObject;
  onApply: (object: MathObject) => void;
}) {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const read = (key: string) => {
      const value = fields.get(key);
      return typeof value === "string" ? value : "";
    };
    const num = (key: string) => Number(read(key));
    let next = fitObject({
      ...object,
      label: read("label"),
      x: num("x"),
      y: num("y"),
      width: num("width"),
      height: num("height"),
    });
    try {
      switch (object.type) {
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
          parseOperation(expression);
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
          "Revisa los valores. Las fracciones admiten hasta 3 unidades y denominadores de 1 a 24.",
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
            Dos fracciones no negativas. Suma o resta; resultado ≥ 0 y
            denominador común ≤ 60.
          </small>
          <label>
            Paso
            <select name="stage" defaultValue={object.data.stage}>
              <option value={0}>1 · Representar</option>
              <option value={1}>2 · Homogeneizar</option>
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
              max={1100}
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
