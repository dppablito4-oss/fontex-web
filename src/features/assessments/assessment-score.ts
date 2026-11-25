export const universityQuestionCount = 10;
export const universityTechnicalCount = 6;

const levels = [
  { max: 2, label: "Inicial", tone: "red", fill: "#FEE2E2", ink: "#991B1B" },
  { max: 4, label: "Básico", tone: "orange", fill: "#FFEDD5", ink: "#9A3412" },
  { max: 6, label: "En desarrollo", tone: "yellow", fill: "#FEF3C7", ink: "#854D0E" },
  { max: 8, label: "Competente", tone: "blue", fill: "#DBEAFE", ink: "#1E40AF" },
  { max: 10, label: "Avanzado", tone: "green", fill: "#DCFCE7", ink: "#166534" },
] as const;

export function assessmentLevel(score: number) {
  return levels.find((level) => score <= level.max) ?? levels[4];
}
