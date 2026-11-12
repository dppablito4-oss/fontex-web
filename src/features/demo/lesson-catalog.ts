import lessons from "../../../supabase/functions/_shared/practice/lessons.json";

export const lessonLevels = {
  inicial: "Inicial",
  primaria: "Primaria",
  secundaria: "Secundaria",
  universidad: "Universidad introductoria",
} as const;
export type LessonLevel = keyof typeof lessonLevels;

export function lessonLevel(lessonId: string): LessonLevel {
  const level = lessons.find(({ id }) => id === lessonId)?.level;
  return level && Object.hasOwn(lessonLevels, level) ? level as LessonLevel : "primaria";
}

export function gradeLabel(level: LessonLevel, grade: number) {
  return level === "inicial" ? `${grade} años` : level === "universidad" ? "Ingreso universitario" : `${grade}.º`;
}

export function availableGrades(level: LessonLevel) {
  return [...new Set(lessons.filter(lesson => lesson.level === level).flatMap(lesson => lesson.grades))].sort((a, b) => a - b);
}
