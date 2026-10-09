import { ArrowRight, BookOpenCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";

import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "./AuthProvider";

type Mode = "signin" | "signup";

export function AuthPage() {
  const { signIn, signUp, error: authError } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setLocalError(null);

    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        const requiresConfirmation = await signUp(displayName, email.trim(), password);
        if (requiresConfirmation) {
          setMessage("Revisa tu correo para confirmar la cuenta antes de iniciar sesión.");
          setMode("signin");
          setPassword("");
        }
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "No fue posible completar la solicitud.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-paper px-4 py-8 text-ink sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <BrandMark />
        <span className="text-xs font-semibold text-muted">Fuentes puestas en contexto</span>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <section>
          <p className="eyebrow">Identidad protegida</p>
          <h1 className="mt-4 max-w-2xl font-display text-[clamp(3rem,7vw,6rem)] leading-[.9] tracking-[-.055em]">
            Aprende con tus fuentes, no a ciegas.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted">
            Tu identidad determina qué aulas, grupos y materiales puedes consultar. Los permisos se verifican en la base de datos, no solo en la interfaz.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              [ShieldCheck, "RLS activo", "Aislamiento por aula"],
              [LockKeyhole, "Acceso privado", "Sesiones con Supabase Auth"],
              [BookOpenCheck, "Contexto autorizado", "Base para el RAG"],
            ].map(([Icon, title, detail]) => {
              const FeatureIcon = Icon as typeof ShieldCheck;
              return (
                <div className="rounded-2xl border border-line bg-surface p-4" key={String(title)}>
                  <FeatureIcon className="size-5 text-forest" />
                  <strong className="mt-4 block text-sm">{String(title)}</strong>
                  <span className="mt-1 block text-xs text-muted">{String(detail)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <Card className="p-6 sm:p-8">
          <div className="flex rounded-xl bg-sage p-1" aria-label="Modo de acceso">
            <button
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signin" ? "bg-white shadow-sm" : "text-muted"}`}
              onClick={() => setMode("signin")}
              type="button"
            >
              Iniciar sesión
            </button>
            <button
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-white shadow-sm" : "text-muted"}`}
              onClick={() => setMode("signup")}
              type="button"
            >
              Crear cuenta
            </button>
          </div>

          <form className="mt-7 space-y-5" onSubmit={(event) => void submit(event)}>
            {mode === "signup" && (
              <label className="form-field">
                <span>Nombre visible</span>
                <input
                  autoComplete="name"
                  maxLength={80}
                  minLength={1}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  value={displayName}
                />
              </label>
            )}
            <label className="form-field">
              <span>Correo</span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="form-field">
              <span>Contraseña</span>
              <input
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              {mode === "signup" && <small>Usa al menos 8 caracteres.</small>}
            </label>

            {(localError ?? authError) && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                {localError ?? authError}
              </p>
            )}
            {message && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
                {message}
              </p>
            )}

            <Button className="w-full" disabled={pending} type="submit">
              {pending ? "Procesando…" : mode === "signin" ? "Entrar a Fontex" : "Crear cuenta"}
              {!pending && <ArrowRight className="size-4" />}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

export function AuthLoadingPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 text-ink">
      <div className="text-center" role="status">
        <BrandMark />
        <p className="mt-5 text-sm text-muted">Verificando tu sesión…</p>
      </div>
    </main>
  );
}
