import {
  AssistantRuntimeProvider,
  useLocalRuntime,
} from "@assistant-ui/react";
import type { ReactNode } from "react";

import { tutorAdapter, tutorInitialMessages } from "./tutorRuntime";

export function FontexRuntimeProvider({ children }: { children: ReactNode }) {
  const runtime = useLocalRuntime(tutorAdapter, { initialMessages: tutorInitialMessages });
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
