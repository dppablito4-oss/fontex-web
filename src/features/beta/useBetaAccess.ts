import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/AuthProvider";
export function useBetaAccess() {
  const { user } = useAuth(), owner = user?.id ?? "";
  const [value, setValue] = useState<
    { owner: string; status: "allowed" | "denied" | "error"; lastVerifiedAllowed: boolean }
  >({ owner: "", status: "denied", lastVerifiedAllowed: false });
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const refresh = useCallback(async () => {
    if (!owner || !supabase) return;
    const request = ++sequence.current;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const { data, error } = await Promise.race([
        supabase.rpc("get_beta_access_status"),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(Error("beta access timeout")), 10000);
        }),
      ]);
      const allowed =
        data && typeof data === "object" && !Array.isArray(data) &&
          typeof data.allowed === "boolean"
          ? data.allowed
          : null;
      if (request === sequence.current) {
        setValue((current) => ({
          owner,
          status: error || allowed === null
            ? "error"
            : allowed
            ? "allowed"
            : "denied",
          lastVerifiedAllowed: error || allowed === null
            ? current.owner === owner && current.lastVerifiedAllowed
            : allowed,
        }));
      }
    } catch {
      if (request === sequence.current) setValue((current) => ({ owner, status: "error", lastVerifiedAllowed: current.owner === owner && current.lastVerifiedAllowed }));
    } finally {
      clearTimeout(timeout);
    }
  }, [owner]);
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) void refresh();
    };
    update();
    window.addEventListener("focus", update);
    const timer = window.setInterval(update, 30000);
    return () => {
      active = false;
      invalidate();
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [refresh, invalidate]);
  return {
    status: !owner
      ? "local" as const
      : value.owner === owner
      ? value.status
      : "loading" as const,
    refresh,
    lastVerifiedAllowed: value.owner === owner && value.lastVerifiedAllowed,
  };
}
