import { useContext } from "react";
import type { MathObject } from "../../core/document-schema/document";
import { TeachingLevel } from "./teaching-level";
import { lessonSteps } from "./lesson-steps";
export function LessonSteps({ object }: { object: MathObject }) {
  const level = useContext(TeachingLevel);
  const steps = lessonSteps(object, level);
  if (!steps.length) return null;
  return <details className="st-lesson" open><summary>Explicación paso a paso</summary><ol>{steps.map(([title, text], i) => <li key={title}><strong>{i + 1}. {title}</strong><p>{text}</p></li>)}</ol></details>;
}
