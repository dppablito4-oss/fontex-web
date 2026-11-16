import { z } from "zod";
import {
  parsePrimitiveScene,
  type PrimitiveScene,
} from "../../core/primitives/schema";
import { classroomClient, readClassroomGuest } from "./classroom-access";
const summary = z.object({
  id: z.uuid(),
  title: z.string(),
  topic: z.string(),
  class_date: z.string(),
  week: z.number(),
  instructions: z.string(),
  due_at: z.string().nullable(),
  status: z.string().nullable(),
  deliveries: z.number(),
});
export type LessonSummary = z.infer<typeof summary>;
export type Material = { path: string; name: string; type: "application/pdf" };
export type Submission = {
  id: string;
  name?: string;
  scene: PrimitiveScene;
  status: string;
  feedback: string;
  updated_at: string;
};
export type Lesson = LessonSummary & {
  classroom_id: string;
  scene: PrimitiveScene;
  teacher: boolean;
  attachments: Material[];
  submission: Submission | null;
};
export async function listLessons(classroom: string) {
  const { data, error } = await classroomClient().rpc("list_class_lessons", {
    p_classroom: classroom,
    p_guest: readClassroomGuest()?.token ?? null,
  });
  if (error)
    throw Error(
      "No se pudieron cargar las clases. Comprueba tu acceso e inténtalo de nuevo.",
    );
  return z.array(summary).parse(data);
}
export async function loadLesson(id: string): Promise<Lesson> {
  const { data, error } = await classroomClient().rpc("get_class_lesson", {
    p_id: id,
    p_guest: readClassroomGuest()?.token ?? null,
  });
  if (error || !data)
    throw Error(
      "No tienes acceso a esta clase. Entra con tu cuenta o con una invitación vigente del aula.",
    );
  const r = z
    .object({
      id: z.uuid(),
      classroom_id: z.uuid(),
      title: z.string(),
      topic: z.string(),
      class_date: z.string(),
      week: z.number(),
      instructions: z.string(),
      due_at: z.string().nullable(),
      scene: z.unknown(),
      teacher: z.boolean(),
      attachments: z.array(
        z.object({
          path: z.string(),
          name: z.string(),
          type: z.literal("application/pdf"),
        }),
      ),
      submission: z
        .object({
          id: z.uuid(),
          scene: z.unknown(),
          status: z.string(),
          feedback: z.string(),
          updated_at: z.string(),
        })
        .nullable(),
    })
    .parse(data);
  return {
    ...r,
    status: r.submission?.status ?? null,
    deliveries: 0,
    scene: parsePrimitiveScene(r.scene),
    submission: r.submission
      ? { ...r.submission, scene: parsePrimitiveScene(r.submission.scene) }
      : null,
  };
}
export async function classroomAction(
  lesson: string,
  action: "save" | "material" | "notify",
  extra: Record<string, unknown> = {},
) {
  const guest = readClassroomGuest();
  const result = await classroomClient().functions.invoke<unknown>(
    "classroom-api",
    {
      body: { lesson, action, ...extra },
      headers: guest ? { "x-classroom-guest": guest.token } : undefined,
    },
  );
  const data: unknown = result.data,
    error: unknown = result.error;
  if (error) {
    let message =
      "No se pudo completar la acción. Comprueba tu conexión y tu acceso al aula.";
    const context: unknown =
      error && typeof error === "object" && "context" in error
        ? error.context
        : null;
    if (context instanceof Response)
      try {
        const value: unknown = await context.json();
        if (
          value &&
          typeof value === "object" &&
          "message" in value &&
          typeof value.message === "string"
        )
          message = value.message;
      } catch {
        /* Generic error */
      }
    throw Error(message);
  }
  return data as {
    id?: string;
    url?: string;
    message?: string;
    pending?: boolean;
    sent?: number;
  };
}
export async function listSubmissions(id: string): Promise<Submission[]> {
  const { data, error } = await classroomClient().rpc(
    "class_lesson_submissions",
    { p_id: id },
  );
  if (error) throw Error("No se pudieron cargar las entregas.");
  return z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        scene: z.unknown(),
        status: z.string(),
        feedback: z.string(),
        updated_at: z.string(),
      }),
    )
    .parse(data)
    .map((v) => ({ ...v, scene: parsePrimitiveScene(v.scene) }));
}
