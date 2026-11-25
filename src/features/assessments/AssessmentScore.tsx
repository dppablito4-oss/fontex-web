import { assessmentLevel, universityQuestionCount } from "./assessment-score";
import "./assessments.css";

export function AssessmentScore({ score }: { score: number }) {
  const level = assessmentLevel(score);
  return <span className="assessment-score" data-tone={level.tone} style={{ color: level.ink, backgroundColor: level.fill }}>
    <strong>{score}/{universityQuestionCount}</strong> · {level.label}
  </span>;
}
