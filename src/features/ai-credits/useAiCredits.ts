import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useClassroomGuest } from "../classrooms/classroom-guest-context";
import { classroomClient } from "../classrooms/classroom-access";
import { creditStatusSchema } from "./service";
import { type CreditStatus, getCreditStatus } from "./service";
export function useAiCredits() {
  const { user } = useAuth();
  const { guest } = useClassroomGuest();
  const token = guest?.token;
  const owner = guest ? `guest:${guest.id}` : user?.id ?? "";
  const [value, setValue] = useState<
    { owner: string; status: CreditStatus | null; error: string | null }
  >({ owner: "", status: null, error: null });
  const sequence = useRef(0);
  const refresh = useCallback(() => {
    if (!owner) return Promise.resolve();
    const request = ++sequence.current;
    const requestStatus = token ? classroomClient().rpc("get_guest_ai_status", {p_token:token}).then(r => { if(r.error) throw r.error; return creditStatusSchema.parse(r.data); }) : getCreditStatus();
    return Promise.resolve(requestStatus).then((status) => {
      if (request === sequence.current) {
        setValue({ owner, status, error: null });
      }
    }).catch(() => {
      if (request === sequence.current) {
        setValue({
          owner,
          status: null,
          error: "No se pudo consultar el saldo. El chat sigue disponible.",
        });
      }
    });
  }, [owner, token]);
  useEffect(() => {
    if (!owner) return;
    void refresh();
    const focus = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("fontex-ai-credits-changed", focus);
    const timer = window.setInterval(focus, 20000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("fontex-ai-credits-changed", focus);
    };
  }, [owner, refresh]);
  return {
    status: value.owner === owner ? value.status : null,
    error: value.owner === owner ? value.error : null,
    refresh,
  };
}
