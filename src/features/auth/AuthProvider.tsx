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
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
};

const unavailable = () => Promise.reject(new Error("Supabase no está configurado en este entorno."));

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
  signOut: unavailable,
  updateDisplayName: unavailable,
};

const AuthContext = createContext<AuthContextValue>(defaultContext);

function readableAuthError(message: string) {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "El correo o la contraseña no son correctos.";
  }
  if (message.toLowerCase().includes("already registered")) {
    return "Ese correo ya está registrado.";
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? "loading" : "unconfigured");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(readableAuthError(sessionError.message));
      setSession(data.session);
      setStatus(data.session ? "authenticated" : "anonymous");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "anonymous");
      if (!nextSession) setProfile(null);
    });

    return () => {
      active = false;
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
          setError(readableAuthError(profileError.message));
          return;
        }
        setProfile({ id: data.id, displayName: data.display_name });
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

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
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          const message = readableAuthError(signInError.message);
          setError(message);
          throw new Error(message);
        }
      },
      async signUp(displayName, email, password) {
        if (!supabase) return unavailable();
        setError(null);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (signUpError) {
          const message = readableAuthError(signUpError.message);
          setError(message);
          throw new Error(message);
        }
        return data.session === null;
      },
      async signOut() {
        if (!supabase) return unavailable();
        setError(null);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          const message = readableAuthError(signOutError.message);
          setError(message);
          throw new Error(message);
        }
      },
      async updateDisplayName(displayName) {
        if (!supabase || !session?.user.id) return unavailable();
        const normalizedName = displayName.trim();
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ display_name: normalizedName })
          .eq("id", session.user.id);
        if (updateError) throw new Error(readableAuthError(updateError.message));
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
