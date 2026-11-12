import { ArrowLeft, ArrowRight } from "lucide-react";
import type {
  FractionData,
  MathObject,
  OperationData,
  Shape,
} from "../../core/document-schema/document";
import { sequenceTerms } from "../../core/math-engine/sequences";
import { parseOperation } from "../../core/math-engine/fractions";
import { CollectionObject, LinearEquationObject, NumberLineObject } from "./ExtendedMathObjects";

function FractionLabel({ n, d }: { n: number; d: number }) {
  return (
    <span className="st-fraction" aria-label={`${n} sobre ${d}`}>
      <span>{n}</span>
      <span>{d}</span>
    </span>
  );
}
function FractionDrawing({
  n,
  d,
  shape,
  splitAt,
  original,
}: {
  n: number;
  d: number;
  shape: Shape;
  splitAt?: number;
  original?: number;
}) {
  const units = Math.max(1, Math.ceil(n / d));
  return (
    <div
      className={`st-figures st-${shape}`}
      role="img"
      aria-label={`${n} de ${d} partes por unidad`}
    >
      {Array.from({ length: units }, (_, unit) => (
        <svg
          key={unit}
          viewBox={shape === "bar" ? "0 0 240 60" : "0 0 120 120"}
        >
          {Array.from({ length: d }, (_, i) => {
            const index = unit * d + i;
            const fill =
              index >= n
                ? "var(--st-piece-empty)"
                : splitAt !== undefined && index >= splitAt
                  ? "var(--st-piece-secondary)"
                  : "var(--st-piece-primary)";
            if (shape === "bar")
              return (
                <rect
                  key={i}
                  x={(i * 240) / d}
                  y={0}
                  width={240 / d}
                  height={60}
                  fill={fill}
                  stroke="var(--st-piece-stroke)"
                  strokeWidth={1.5}
                />
              );
            const angle = (2 * Math.PI) / d,
              start = i * angle - Math.PI / 2,
              end = start + angle;
            return d === 1 ? (
              <circle key={i} cx={60} cy={60} r={54} fill={fill} />
            ) : (
              <path
                key={i}
                d={`M60 60 L${60 + 54 * Math.cos(start)} ${60 + 54 * Math.sin(start)} A54 54 0 ${angle > Math.PI ? 1 : 0} 1 ${60 + 54 * Math.cos(end)} ${60 + 54 * Math.sin(end)} Z`}
                fill={fill}
                stroke="var(--st-piece-stroke)"
                strokeWidth={1.5}
              />
            );
          })}
          {shape === "bar" &&
            original &&
            Array.from({ length: original - 1 }, (_, i) => (
              <line
                key={i}
                x1={((i + 1) * 240) / original}
                x2={((i + 1) * 240) / original}
                y1={0}
                y2={60}
                stroke="var(--st-piece-guide)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            ))}
        </svg>
      ))}
    </div>
  );
}
function FractionObject({ data }: { data: FractionData }) {
  return (
    <div className="st-single-fraction">
      <FractionLabel n={data.numerator} d={data.denominator} />
      <FractionDrawing
        n={data.numerator}
        d={data.denominator}
        shape={data.shape}
      />
      <p>Cada figura completa vale una unidad.</p>
    </div>
  );
}
function OperationObject({
  data,
  onChange,
}: {
  data: OperationData;
  onChange: (data: OperationData) => void;
}) {
  const op = parseOperation(data.expression);
  const common = data.stage > 0;
  const result = data.stage === 2;
  const n1 = common ? op.left : op.a.n,
    n2 = common ? op.right : op.b.n;
  return (
    <div className="st-operation">
      <div className="st-operation-title">
        <strong>{data.expression}</strong>
        <span>
          {["Representar", "Homogeneizar", "Resolver"][data.stage]} ·{" "}
          {data.stage + 1}/3
        </span>
      </div>
      <div className="st-operands">
        <div>
          <FractionLabel n={n1} d={common ? op.denominator : op.a.d} />
          <FractionDrawing
            n={n1}
            d={common ? op.denominator : op.a.d}
            shape={data.shape}
            original={common ? op.a.d : undefined}
          />
          {common && (
            <small>
              {op.a.n}/{op.a.d} × {op.denominator / op.a.d}/
              {op.denominator / op.a.d} = {op.left}/{op.denominator}
            </small>
          )}
        </div>
        <span className="st-operator">{op.operator === "+" ? "+" : "−"}</span>
        <div>
          <FractionLabel n={n2} d={common ? op.denominator : op.b.d} />
          <FractionDrawing
            n={n2}
            d={common ? op.denominator : op.b.d}
            shape={data.shape}
            original={common ? op.b.d : undefined}
          />
          {common && (
            <small>
              {op.b.n}/{op.b.d} × {op.denominator / op.b.d}/
              {op.denominator / op.b.d} = {op.right}/{op.denominator}
            </small>
          )}
        </div>
        {result && (
          <>
            <span className="st-operator">=</span>
            <div>
              <FractionLabel n={op.total} d={op.denominator} />
              <FractionDrawing
                n={op.total}
                d={op.denominator}
                shape={data.shape}
                splitAt={op.operator === "+" ? op.left : undefined}
              />
              <small>
                Resultado simplificado: {op.simplified.n}/{op.simplified.d}
              </small>
            </div>
          </>
        )}
      </div>
      <p className="st-math-explanation" aria-live="polite">
        {data.stage === 0
          ? "Comparamos la misma unidad. Si las divisiones son distintas, las piezas tienen distinto tamaño."
          : data.stage === 1
            ? `El m.c.m. de ${op.a.d} y ${op.b.d} es ${op.denominator}. Subdividimos sin cambiar el área coloreada: ${op.a.n}/${op.a.d} = ${op.left}/${op.denominator} y ${op.b.n}/${op.b.d} = ${op.right}/${op.denominator}.`
            : `Cada pieza vale 1/${op.denominator}. ${op.operator === "+" ? "Reunimos" : "Quitamos"} piezas: ${op.left} ${op.operator} ${op.right} = ${op.total}. El denominador se conserva porque el tamaño de las piezas sigue siendo el mismo.`}
      </p>
      <div className="st-step-buttons">
        <button
          aria-label="Paso anterior"
          disabled={data.stage === 0}
          onClick={() => onChange({ ...data, stage: data.stage - 1 })}
        >
          <ArrowLeft size={16} /> Anterior
        </button>
        <button
          onClick={() => onChange({ ...data, stage: (data.stage + 1) % 3 })}
        >
          {
            ["Homogeneizar", "Ver resultado", "Volver a representar"][
              data.stage
            ]
          }
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function MathObjectRenderer({
  object,
  onChange,
}: {
  object: MathObject;
  onChange: (object: MathObject) => void;
}) {
  switch (object.type) {
    case "collection": return <CollectionObject data={object.data} />;
    case "number-line": return <NumberLineObject data={object.data} />;
    case "linear-equation": return <LinearEquationObject data={object.data} onChange={data => onChange({ ...object, data })} />;
    case "fraction":
      return <FractionObject data={object.data} />;
    case "operation":
      return (
        <OperationObject
          data={object.data}
          onChange={(data) => onChange({ ...object, data })}
        />
      );
    case "text":
      return (
        <div
          className="st-text-content"
          style={{ fontSize: object.data.fontSize }}
        >
          {object.data.content}
        </div>
      );
    case "sequence": {
      const terms = sequenceTerms(object.data);
      return (
        <div className="st-sequence">
          <div className="st-sequence-terms">
            {terms.map((value, i) => (
              <div className="st-term" key={i}>
                <small>Término {i + 1}</small>
                <strong>{value}</strong>
                {value >= 0 && value <= 30 && (
                  <div
                    className="st-dots"
                    role="img"
                    aria-label={`${value} puntos`}
                  >
                    {Array.from({ length: value }, (_, j) => (
                      <span key={j} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="st-math-explanation">
            Empezamos en <strong>{object.data.start}</strong>.{" "}
            {object.data.difference >= 0 ? "Sumamos" : "Restamos"}{" "}
            <strong>{Math.abs(object.data.difference)}</strong> en cada paso.
          </p>
          <p className="st-sequence-rule">
            aₙ = {object.data.start} + (n − 1) × ({object.data.difference})
          </p>
          <small>
            Las figuras con 0 a 30 puntos se muestran pictóricamente; los demás
            términos se muestran como números.
          </small>
        </div>
      );
    }
  }
}
