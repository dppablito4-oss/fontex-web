import { z } from "zod";
import { supabase } from "../../lib/supabase/client";
import { universityQuestionCount } from "./assessment-score";

const kind = z.enum(["survey", "pretest"]);
const questionKind = z.enum(["text", "choice", "multiple"]);
const question = z.object({
  position: z.number().int().positive(),
  prompt: z.string(),
  kind: questionKind,
  options: z.array(z.string()),
});
const score = z.number().int().min(0).max(universityQuestionCount);
const universityTemplate = z.object({
  title: z.string(),
  kind: z.literal("pretest"),
  description: z.string(),
  questions: z.array(question.omit({ position: true }).extend({
    kind: z.literal("choice"),
    correct_option: z.string(),
  })).length(universityQuestionCount),
});
const publicForm = z.object({
  title: z.string(),
  kind,
  description: z.string(),
  is_open: z.boolean(),
  questions: z.array(question),
});
const summary = publicForm.pick({ title: true, kind: true, is_open: true }).extend({
  id: z.uuid(),
  created_at: z.string(),
});
const accessCode = z.object({
  code: z.string(),
  student_name: z.string().nullable(),
  submitted_at: z.string().nullable(),
  score: score.nullish(),
});
const detail = publicForm.extend({
  id: z.uuid(),
  token: z.uuid(),
  created_at: z.string(),
  codes: z.array(accessCode),
  graded: z.boolean().optional(),
});
const browserAssessment = z.discriminatedUnion("state", [
  publicForm.omit({ is_open: true }).extend({ state: z.literal("open"), question_version: z.number().int().positive(), graded: z.boolean().optional() }),
  z.object({ state: z.literal("submitted"), title: z.string().optional(), score: score.nullish() }),
  z.object({ state: z.literal("closed"), title: z.string().optional() }),
]);
const answerList = z.array(z.object({ code: z.string(), answers: z.array(z.string()) }));

export type AssessmentKind = z.infer<typeof kind>;
export type QuestionKind = z.infer<typeof questionKind>;
export type AssessmentQuestion = z.infer<typeof question>;
export type AssessmentQuestionDraft = Omit<AssessmentQuestion, "position"> & { correct_option?: string };
export type BrowserAssessment = z.infer<typeof browserAssessment>;
export type StudentAnswer = string | string[];
export type AssessmentSummary = z.infer<typeof summary>;
export type AssessmentDetail = z.infer<typeof detail>;
export type AssessmentCode = z.infer<typeof accessCode>;

export const assessmentKindLabel: Record<AssessmentKind, string> = { survey: "Encuesta", pretest: "Pretest" };
export const questionKindLabel: Record<QuestionKind, string> = {
  text: "Respuesta libre", choice: "Selección única", multiple: "Selección múltiple",
};
export const assessmentPageSize = 25;
export const assessmentAnswerBatch = 25;

export function deliveryDate(value: string) {
  return new Date(value).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}

function client() {
  if (!supabase) throw Error("Fontex no está conectado a la base de datos en este entorno.");
  return supabase;
}
function adminError(code: string, fallback: string) {
  return Error(code === "42501" ? "Tu sesión no tiene permiso para revisar estas evaluaciones." : fallback);
}

export async function listAssessments(offset: number) {
  const { data, error } = await client().rpc("admin_list_assessments", { p_offset: offset });
  if (error) throw adminError(error.code, "No se pudieron cargar las evaluaciones.");
  const forms = z.array(summary).parse(data);
  return { forms: forms.slice(0, assessmentPageSize), hasMore: forms.length > assessmentPageSize };
}

export async function loadUniversityPretest() {
  const { data, error } = await client().rpc("admin_get_university_pretest");
  if (error) throw adminError(error.code, "No se pudo cargar la plantilla de Fontex.");
  return universityTemplate.parse(data);
}

export async function createAssessment(values: {
  request: string;
  title: string;
  kind: AssessmentKind;
  description: string;
  questions: AssessmentQuestionDraft[];
}) {
  const { data, error } = await client().rpc("admin_create_assessment", {
    p_request: values.request,
    p_title: values.title,
    p_kind: values.kind,
    p_description: values.description,
    p_questions: values.questions,
    p_code_count: 0,
  });
  if (error) {
    const message = error.code === "22023"
      ? "Revisa el título y las preguntas antes de publicar."
      : "No se pudo confirmar la publicación. Puedes reintentar desde este formulario.";
    throw adminError(error.code, message);
  }
  return z.uuid().parse(data);
}

export async function getAssessment(id: string) {
  const { data, error } = await client().rpc("admin_get_assessment", { p_form: id });
  if (error) throw adminError(error.code, "No se pudo abrir la evaluación.");
  if (data === null) throw Error("Esta evaluación no está disponible para tu cuenta.");
  return detail.parse(data);
}

export async function setAssessmentOpen(id: string, open: boolean) {
  const { error } = await client().rpc("admin_set_assessment_open", { p_form: id, p_open: open });
  if (error) throw adminError(error.code, "No se pudo cambiar el estado de la evaluación.");
}

export async function getAssessmentAnswers(id: string, codes: string[]) {
  const { data, error } = await client().rpc("admin_assessment_answers", { p_form: id, p_codes: codes });
  if (error) throw adminError(error.code, "No se pudieron cargar las respuestas.");
  return answerList.parse(data);
}

export async function deleteAssessment(id: string) {
  const { error } = await client().rpc("admin_delete_assessment", { p_form: id });
  if (error) throw adminError(error.code, "No se pudo eliminar la evaluación.");
}

export async function deleteAssessmentQuestion(id: string, position: number) {
  const { error } = await client().rpc("admin_delete_assessment_question", { p_form: id, p_position: position });
  if (error) throw adminError(error.code, error.message === "assessment_last_question"
    ? "La evaluación debe conservar al menos una pregunta." : "No se pudo eliminar la pregunta.");
}

export function validAssessmentToken(token: string) {
  return z.uuid().safeParse(token).success;
}

export async function loadBrowserAssessment(token: string, browserId: string) {
  const { data, error } = await client().rpc("get_browser_assessment", { p_token: token, p_browser: browserId });
  if (error) throw Error("No se pudo abrir el formulario. Comprueba tu conexión y vuelve a intentar.");
  return browserAssessment.parse(data);
}

export async function submitBrowserAssessment(
  token: string, browserId: string, name: string, questionVersion: number, answers: StudentAnswer[],
) {
  const { data, error } = await client().rpc("submit_browser_assessment", {
    p_token: token, p_browser: browserId, p_name: name, p_question_version: questionVersion, p_answers: answers,
  });
  if (error) {
    if (error.message === "assessment_invalid_answers") throw Error("Revisa que todas tus respuestas sean válidas.");
    if (error.message === "assessment_invalid_submission") throw Error("Escribe tu nombre para enviar las respuestas.");
    throw Error("No pudimos confirmar el envío. Conserva tus respuestas y vuelve a intentar.");
  }
  return z.enum(["submitted", "closed", "changed"]).parse(data);
}
