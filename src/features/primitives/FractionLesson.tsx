import { Fragment, type ReactNode } from "react";
import type { Primitive } from "../../core/primitives/schema";
import type { FractionLesson as Lesson } from "../../core/primitives/fraction-lessons";

export function FractionLesson({ lesson, renderPrimitive }: {
  lesson: Lesson;
  renderPrimitive: (p: Primitive, generated: boolean) => ReactNode;
}) {
  const used = new Set(lesson.equation?.terms.map(t => t.primitive.id));
  const remaining = lesson.figures.filter(p => !used.has(p.id));
  return <section className="pc-fraction-section" aria-label={`Explicación y dibujos · paso ${lesson.step}`}>
    <div className="pc-fraction-explanation">{lesson.texts.map(p => <Fragment key={p.id}>{renderPrimitive(p,false)}</Fragment>)}</div>
    {lesson.equation && <div className="pc-fraction-row" role="group" aria-label="Operación de fracciones">
      {lesson.equation.terms.map((term,index) => <Fragment key={term.primitive.id}>
        {index > 0 && <span className="pc-fraction-operator" aria-hidden="true">{index === 1 ? lesson.equation!.operator : "="}</span>}
        <div className="pc-fraction-term">{renderPrimitive(term.primitive,term.generated)}</div>
      </Fragment>)}
    </div>}
    {!!remaining.length && <div className="pc-fraction-grid">{remaining.map(p => <div key={p.id}>{renderPrimitive(p,false)}</div>)}</div>}
  </section>;
}
