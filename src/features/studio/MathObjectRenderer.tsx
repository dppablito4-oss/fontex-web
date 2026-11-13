import { InlineValue, InlineOnly } from "./InlineValue";
import { isLearningObject } from "../../core/math-engine/learning-types";
import { LearningMathObject } from "./LearningMathObjects";
import { PolygonObject, FactorizationObject } from "./AdaptedMathObjects";
import { useContext } from "react";
import { LessonSteps } from "./LessonSteps";
import { TeachingLevel } from "./teaching-level";
import { GeometryObject } from "./GeometryObject";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type {
  FractionData,
  MathObject,
  OperationData,
  Shape,
} from "../../core/document-schema/document";
import { sequenceTerms } from "../../core/math-engine/sequences";
import { parseStudioOperation, type FractionProduct } from "../../core/math-engine/studio-operations";
import { CollectionObject, LinearEquationObject, NumberLineObject } from "./ExtendedMathObjects";

function FractionLabel({ n, d, editable = false }: { n: number; d: number; editable?: boolean }) {
  return (
    <span className="st-fraction" aria-label={`${n} sobre ${d}`}>
      <span>{editable ? <InlineValue field="numerator" value={n} /> : n}</span>
      <span>{editable ? <InlineValue field="denominator" value={d} /> : d}</span>
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
      <FractionLabel n={data.numerator} d={data.denominator} editable />
      <InlineOnly><div className="st-inline-caption"><InlineValue field="shape" value={data.shape} /></div></InlineOnly>
      <FractionDrawing
        n={data.numerator}
        d={data.denominator}
        shape={data.shape}
      />
      <p>Cada figura completa vale una unidad.</p>
    </div>
  );
}
function MultiplicationObject({ data, operation, onChange }: { data: OperationData; operation: FractionProduct; onChange: (data: OperationData) => void }) {
  const { a, b, total, denominator, simplified } = operation;
  return <div className="st-operation">
    <div className="st-operation-title"><strong><InlineValue field="expression" value={data.expression} /></strong><InlineOnly><InlineValue field="shape" value={data.shape} /></InlineOnly><span className="st-operation-stage">{["Representar", "Multiplicar", "Simplificar"][data.stage]} · {data.stage + 1}/3</span></div>
    <div className="st-operands">
      <div><FractionLabel n={a.n} d={a.d} /><FractionDrawing n={a.n} d={a.d} shape={data.shape} /></div>
      <span className="st-operator">×</span>
      <div><FractionLabel n={b.n} d={b.d} /><FractionDrawing n={b.n} d={b.d} shape={data.shape} /></div>
      {data.stage > 0 && <><span className="st-operator">=</span><div>
        <FractionLabel n={data.stage === 1 ? total : simplified.n} d={data.stage === 1 ? denominator : simplified.d} />
        {data.stage === 2 && simplified.d <= 60 && <FractionDrawing n={simplified.n} d={simplified.d} shape={data.shape} />}
        {data.stage === 2 && simplified.d > 60 && <small>La fracción exacta se muestra numéricamente para evitar un dibujo con demasiadas divisiones.</small>}
      </div></>}
    </div>
    {a.n <= a.d && b.n <= b.d && a.d * b.d <= 144 && <figure>
      <svg className="st-product-grid" viewBox={`0 0 ${a.d * 24} ${b.d * 24}`} role="img" aria-label={`${a.n * b.n} de ${a.d * b.d} celdas en el cruce de las fracciones`}>
        {Array.from({ length: a.d * b.d }, (_, i) => { const col = i % a.d, row = Math.floor(i / a.d); return <rect key={i} x={col * 24} y={row * 24} width={24} height={24} fill={col < a.n && row < b.n ? "var(--st-piece-primary)" : col < a.n || row < b.n ? "var(--st-piece-secondary)" : "var(--st-piece-empty)"} stroke="var(--st-piece-stroke)" />; })}
      </svg><figcaption>{data.stage === 0 ? "Azul: cruce de las dos partes. Cuenta las celdas azules y las celdas de la unidad." : `Azul: cruce de las dos partes, ${total}/${denominator} de una unidad.`} Naranja: partes de una sola selección.</figcaption>
    </figure>}
    <p className="st-math-explanation" aria-live="polite">{data.stage === 0
      ? "Multiplicar por una fracción significa tomar esa parte de otra cantidad. Los dibujos representan los dos factores; no necesitamos un denominador común."
      : data.stage === 1 ? `Multiplicamos numeradores: ${a.n} × ${b.n} = ${total}. Multiplicamos denominadores: ${a.d} × ${b.d} = ${denominator}. El producto es ${total}/${denominator}.`
      : `Simplificamos ${total}/${denominator} dividiendo numerador y denominador por el mismo divisor común. Resultado simplificado: ${simplified.n}/${simplified.d}.`}</p>
    <div className="st-step-buttons"><button aria-label="Paso anterior" disabled={data.stage === 0} onClick={() => onChange({ ...data, stage: data.stage - 1 })}><ArrowLeft size={16} /> Anterior</button><button onClick={() => onChange({ ...data, stage: (data.stage + 1) % 3 })}>{["Multiplicar factores", "Simplificar producto", "Volver a representar"][data.stage]}<ArrowRight size={16} /></button></div>
  </div>;
}
function OperationObject({
  data,
  onChange,
}: {
  data: OperationData;
  onChange: (data: OperationData) => void;
}) {
  const op = parseStudioOperation(data.expression);
  if (op.operator === "×") return <MultiplicationObject data={data} operation={op} onChange={onChange} />;
  const common = data.stage > 0;
  const result = data.stage === 2;
  const n1 = common ? op.left : op.a.n,
    n2 = common ? op.right : op.b.n;
  return (
    <div className="st-operation">
      <div className="st-operation-title">
        <strong><InlineValue field="expression" value={data.expression} /></strong><InlineOnly><InlineValue field="shape" value={data.shape} /></InlineOnly>
        <span className="st-operation-stage">
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
export function ObjectVisual({
  object,
  onChange,
  lessonStep,
  concealAnswers,
}: {
  object: MathObject;
  onChange: (object: MathObject) => void;
  lessonStep?: number;
  concealAnswers?: boolean;
}) {
  const level = useContext(TeachingLevel);
  if (isLearningObject(object)) return <LearningMathObject object={object} lessonStep={lessonStep} concealAnswers={concealAnswers} />;
  switch (object.type) {
    case "polygon": return <PolygonObject data={object.data} lessonStep={lessonStep} concealAnswers={concealAnswers} />;
    case "factorization": return <FactorizationObject data={object.data} lessonStep={lessonStep} concealAnswers={concealAnswers} />;
    case "geometry": return <GeometryObject data={object.data} />;
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
          <InlineValue field="content" value={object.data.content} /><InlineOnly><small className="st-inline-caption">Tamaño: <InlineValue field="fontSize" value={object.data.fontSize} /> px</small></InlineOnly>
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
          <p className="st-math-explanation st-inline-parameters">
            Empezamos en <strong><InlineValue field="start" value={object.data.start} /></strong>.{" "}
            Cambio por paso: <strong><InlineValue field="difference" value={object.data.difference} /></strong>.
            <InlineOnly> Términos: <InlineValue field="count" value={object.data.count} />.</InlineOnly>
          </p>
          {level !== "initial" && level !== "primary" && <p className="st-sequence-rule">
            aₙ = {object.data.start} + (n − 1) × ({object.data.difference})
          </p>}
          <small>
            Las figuras con 0 a 30 puntos se muestran pictóricamente; los demás
            términos se muestran como números.
          </small>
        </div>
      );
    }
  }
}

export function MathObjectRenderer(props: { object: MathObject; onChange: (object: MathObject) => void }) {
 return <><ObjectVisual {...props} /><LessonSteps object={props.object} /></>;
}
