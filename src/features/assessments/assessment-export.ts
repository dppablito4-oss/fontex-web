import type { SheetData } from "write-excel-file/browser";
import { type AssessmentDetail, assessmentKindLabel } from "./service";
import { assessmentLevel } from "./assessment-score";

function textCell(value: string) {
  return { type: String, value, wrap: true, alignVertical: "top" as const };
}

export function assessmentWorkbookSheets(
  form: AssessmentDetail,
  answers: ReadonlyMap<string, string[]>,
) {
  const heading = ["Estudiante", "Fecha de entrega (UTC)",
    ...(form.graded ? ["Puntaje /10", "Nivel"] : []),
    ...form.questions.map((question, index) => `${index + 1}. ${question.prompt}`),
  ];
  const data: SheetData = [heading.map((label) => ({ ...textCell(label), fontWeight: "bold" }))];

  for (const item of form.codes) {
    const values = answers.get(item.code);
    if (!item.student_name || !item.submitted_at || !values) continue;
    const level = item.score == null ? null : assessmentLevel(item.score);
    const grade = item.score != null && level
      ? [{ type: Number, value: item.score }, {
        ...textCell(level.label), textColor: level.ink, backgroundColor: level.fill,
      }]
      : [null, null];
    data.push([
      textCell(item.student_name),
      { type: Date, value: new Date(item.submitted_at), format: "yyyy-mm-dd hh:mm:ss" },
      ...(form.graded ? grade : []),
      ...values.map(textCell),
    ]);
  }
  return [
    {
      data, sheet: "Respuestas", stickyRowsCount: 1,
      columns: [{ width: 32 }, { width: 26 }, ...(form.graded ? [{ width: 14 }, { width: 20 }] : []),
        ...form.questions.map(() => ({ width: 44 }))],
    },
    {
      sheet: "Evaluación", columns: [{ width: 24 }, { width: 72 }],
      data: [
        ["Título", textCell(form.title)],
        ["Tipo", assessmentKindLabel[form.kind]],
        ["Indicaciones", textCell(form.description)],
      ] satisfies SheetData,
    },
  ];
}

export async function downloadAssessmentWorkbook(form: AssessmentDetail, answers: ReadonlyMap<string, string[]>) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const name = form.title.replace(/[<>:"/\\|?*]/g, "-").slice(0, 80);
  await writeExcelFile(assessmentWorkbookSheets(form, answers)).toFile(`${name}.xlsx`);
}
