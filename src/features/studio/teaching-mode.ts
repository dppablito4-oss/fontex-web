import { createContext } from "react";
import type { AgentMode } from "../../core/agent/protocol";
export const TeachingMode = createContext<AgentMode>("learn");
export const modeDescriptions = {
  learn: "Explora el dibujo y descubre una idea en cada paso.",
  practice: "Inténtalo tú: recibe pistas antes de ver la solución.",
  solve: "Revisa el procedimiento completo y comprueba el resultado.",
};
