import { z } from "zod";
import { supabase } from "../../lib/supabase/client";

const kind = z.enum(["survey", "pretest"]);
const questionKind = z.enum(["text", "choice"]);
const question = z.object({
  position: z.number().int().positive(),
  prompt: z.string(),
  kind: questionKind,
  options: z.array(z.string()),
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
});
const detail = publicForm.extend({
  id: z.uuid(),
  token: z.uuid(),
  created_at: z.string(),
  codes: z.array(accessCode),
});
const answerList = z.array(z.object({ code: z.string(), answers: z.array(z.string()) }));

export type AssessmentKind = z.infer<typeof kind>;
export type QuestionKind = z.infer<typeof questionKind>;
export type AssessmentQuestion = z.infer<typeof question>;
export type PublicAssessment = z.infer<typeof publicForm>;
export type AssessmentSummary = z.infer<typeof summary>;
export type AssessmentDetail = z.infer<typeof detail>;
export type AssessmentCode = z.infer<typeof accessCode>;

export const assessmentKindLabel: Record<AssessmentKind, string> = { survey: "Encuesta", pretest: "Pretest" };
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

export async function createAssessment(values: {
  request: string;
  title: string;
  kind: AssessmentKind;
  description: string;
  questions: Omit<AssessmentQuestion, "position">[];
  codeCount: number;
}) {
  const { data, error } = await client().rpc("admin_create_assessment", {
    p_request: values.request,
    p_title: values.title,
    p_kind: values.kind,
    p_description: values.description,
    p_questions: values.questions,
    p_code_count: values.codeCount,
  });
  if (error) {
    const message = error.code === "22023"
      ? "Revisa el título, los códigos y las preguntas antes de publicar."
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

export async function loadPublicAssessment(token: string) {
  if (!z.uuid().safeParse(token).success) return null;
  const { data, error } = await client().rpc("get_public_assessment", { p_token: token });
  if (error) throw Error("No se pudo cargar el formulario. Comprueba la conexión e inténtalo de nuevo.");
  return publicForm.nullable().parse(data);
}

export async function submitAssessment(token: string, code: string, name: string, request: string, answers: string[]) {
  const { data, error } = await client().rpc("submit_public_assessment", {
    p_token: token, p_code: code, p_name: name, p_request: request, p_answers: answers,
  });
  if (error) {
    const messages: Partial<Record<string, string>> = {
      assessment_closed: "Este formulario ya está cerrado.",
      assessment_invalid_code: "El código no corresponde a esta evaluación. Pídele otro a tu docente.",
      assessment_code_used: "Ya se registró una entrega con ese código.",
      assessment_invalid_answers: "Revisa que hayas respondido todas las preguntas y que el texto sea válido.",
      assessment_invalid_submission: "Escribe tu nombre y el código que te dio tu docente.",
    };
    throw Error(messages[error.message] ?? "No pudimos confirmar el envío. Conserva tus respuestas y vuelve a intentar.");
  }
  if (data !== true) throw Error("No pudimos confirmar el envío. Vuelve a intentar.");
}
