import { createContext } from "react";
import type { AgentLevel } from "../../core/agent/protocol";
export const TeachingLevel = createContext<AgentLevel>("primary");
