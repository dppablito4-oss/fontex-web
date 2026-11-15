import { fractionLessons, type FractionLesson } from "./fraction-lessons.ts";
import type { Primitive, PrimitiveScene } from "./schema.ts";

export type LessonItem = { id: string; step: number } & (
  | { kind: "fraction"; lesson: FractionLesson }
  | { kind: "primitive"; primitive: Primitive }
);

/** One reading order for layout, mobile, public reading and PDF export. */
export function lessonSequence(scene: PrimitiveScene, primitives = scene.primitives): LessonItem[] {
  const roots = primitives.filter(p => !("canvasId" in p.data && p.data.canvasId));
  const order = new Map(scene.primitives.map((p, index) => [p.id, index]));
  const lessons = fractionLessons(scene, roots);
  const members = new Set(lessons.flatMap(l => [...l.texts, ...l.figures].map(p => p.id)));
  const items: (LessonItem & { order: number })[] = [
    ...lessons.map(lesson => ({ kind: "fraction" as const, lesson, id: lesson.id, step: lesson.step,
      order: order.get(lesson.texts[0]!.id)! })),
    ...roots.filter(p => !members.has(p.id)).map(primitive => ({ kind: "primitive" as const, primitive,
      id: primitive.id, step: primitive.presentationStep, order: order.get(primitive.id)! })),
  ];
  const steps = [...new Set(items.map(item => item.step))].sort((a,b) => a-b);
  return steps.flatMap(step => {
    const group = items.filter(item => item.step === step).sort((a,b) => a.order-b.order);
    const explanation = group.findIndex(item => item.kind === "fraction" || item.primitive.kind === "math_block");
    // Earlier templates authored figures before their explanation. Introduce
    // those figures with the first definition, then retain the authored sequence.
    if (explanation > 0) group.unshift(...group.splice(explanation, 1));
    return group;
  });
}
