import { createPortal } from "react-dom";
import { type AssessmentCode, type AssessmentDetail, assessmentKindLabel, deliveryDate } from "./service";
import "./assessments.css";

export function AssessmentSheet({ form, entry, answers, printOnly }: {
  form: AssessmentDetail;
  entry: AssessmentCode;
  answers: string[];
  printOnly?: boolean;
}) {
  const sheet = <article className={printOnly ? "assessment-print-sheet" : "assessment-response"}>
    <header>
      <p>{assessmentKindLabel[form.kind]} · Fontex</p>
      <h3>{form.title}</h3>
      <p><strong>Estudiante </strong>{entry.student_name}</p>
      {entry.submitted_at && <p><strong>Entrega </strong>{deliveryDate(entry.submitted_at)}</p>}
    </header>
    <ol>
      {form.questions.map((question, index) => <li key={question.position}>
        <p><strong>{question.prompt}</strong></p>
        <p className="assessment-answer">{answers[index]}</p>
      </li>)}
    </ol>
  </article>;

  return printOnly ? createPortal(sheet, document.body) : sheet;
}
