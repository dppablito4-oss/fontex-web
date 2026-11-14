import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { type CreditStatus, getCreditStatus } from "./service";
export function useAiCredits() {
  const { user } = useAuth(), owner = user?.id ?? "";
  const [value, setValue] = useState<
    { owner: string; status: CreditStatus | null; error: string | null }
  >({ owner: "", status: null, error: null });
  const sequence = useRef(0);
  const refresh = useCallback(() => {
    if (!owner) return Promise.resolve();
    const request = ++sequence.current;
    return getCreditStatus().then((status) => {
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
  }, [owner]);
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
