import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../../lib/supabase/client";
import { readableAuthError, confirmationRedirectUrl } from "./auth-errors";

type AuthStatus = "unconfigured" | "loading" | "anonymous" | "authenticated";

type Profile = {
  id: string;
  displayName: string;
};

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<boolean>;
  resendConfirmation: (email: string) => Promise<void>;
  clearError: () => void;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
};

const unavailable = () => Promise.reject(new Error("El acceso a tu cuenta no está disponible en este momento."));

const defaultContext: AuthContextValue = {
  status: "unconfigured",
  session: null,
  user: null,
  profile: null,
  error: null,
  signIn: unavailable,
  signUp: async () => {
    await unavailable();
    return false;
  },
  resendConfirmation: unavailable,
  clearError: () => undefined,
  signOut: unavailable,
  updateDisplayName: unavailable,
};

const AuthContext = createContext<AuthContextValue>(defaultContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? "loading" : "unconfigured");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get("error_code") || params.get("error");
    return code ? readableAuthError({ code }) : null;
  });
  const profileDisplayName: string = typeof session?.user.user_metadata?.display_name === "string" ? session.user.user_metadata.display_name : "Usuario Fontex";

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    let authChanged = false;
    const timeout = window.setTimeout(() => {
      if (active && !authChanged) {
        setStatus("anonymous");
        setError("La verificación de tu sesión tardó demasiado. Puedes volver a iniciar sesión.");
      }
    }, 12000);
    const callback = new URLSearchParams(window.location.hash.slice(1));
    const callbackError = callback.get("error_code") || callback.get("error");
    if (callbackError) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/ingresar`);
    }

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || authChanged) return;
      window.clearTimeout(timeout);
      if (sessionError) setError(readableAuthError(sessionError));
      setSession(data.session);
      setStatus(data.session ? "authenticated" : "anonymous");
    }).catch((sessionError: unknown) => {
      if (!active || authChanged) return;
      window.clearTimeout(timeout);
      setError(readableAuthError(sessionError));
      setStatus("anonymous");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event !== "INITIAL_SESSION") authChanged = true;
      window.clearTimeout(timeout);
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "anonymous");
      if (nextSession) setError(null);
      if (!nextSession) setProfile(null);
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) return;

    let active = true;
    void supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error: profileError }) => {
        if (!active) return;
        if (profileError) {
          // A missing optional profile must not prevent authentication.
          setProfile({ id: session.user.id, displayName: profileDisplayName });
          return;
        }
        setProfile({ id: data.id, displayName: data.display_name });
      });

    return () => {
      active = false;
    };
  }, [session?.user.id, profileDisplayName]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      error,
      async signIn(email, password) {
        if (!supabase) return unavailable();
        setError(null);
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) {
          const message = readableAuthError(signInError);
          setError(message);
          throw new Error(message);
        }
        setSession(data.session);
        setStatus(data.session ? "authenticated" : "anonymous");
      },
      async signUp(displayName, email, password) {
        if (!supabase) return unavailable();
        if (!displayName.trim()) throw new Error("Escribe tu nombre visible.");
        setError(null);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() }, emailRedirectTo: confirmationRedirectUrl() },
        });
        if (signUpError) {
          const message = readableAuthError(signUpError);
          setError(message);
          throw new Error(message);
        }
        if (data.session) { setSession(data.session); setStatus("authenticated"); }
        return data.session === null;
      },
      clearError() { setError(null); },
      async resendConfirmation(email) {
        if (!supabase) return unavailable();
        setError(null);
        const { error: resendError } = await supabase.auth.resend({
          type: "signup", email: email.trim(), options: { emailRedirectTo: confirmationRedirectUrl() },
        });
        if (resendError) throw new Error(readableAuthError(resendError));
      },
      async signOut() {
        if (!supabase) return unavailable();
        setError(null);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          const message = readableAuthError(signOutError);
          setError(message);
          throw new Error(message);
        }
        setSession(null);
        setProfile(null);
        setStatus("anonymous");
      },
      async updateDisplayName(displayName) {
        if (!supabase || !session?.user.id) return unavailable();
        const normalizedName = displayName.trim();
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ display_name: normalizedName })
          .eq("id", session.user.id);
        if (updateError) throw new Error(readableAuthError(updateError));
        setProfile({ id: session.user.id, displayName: normalizedName });
      },
    }),
    [error, profile, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
