import { ArrowRight } from "lucide-react";
import { type FormEvent, useState } from "react";

import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ThemeToggle } from "../theme/ThemeToggle";
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
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <BrandMark />
        <ThemeToggle />
      </header>
      <div className="mx-auto mt-12 w-full max-w-md sm:mt-20">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Bienvenido a Fontex</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Retoma tus lecturas, tus prácticas y tus conversaciones.</p>
        </div>
        <Card className="p-6 sm:p-8">
          <div className="flex rounded-xl bg-subtle p-1" aria-label="Modo de acceso">
            <button
              aria-pressed={mode === "signin"}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signin" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setMode("signin")}
              type="button"
            >
              Iniciar sesión
            </button>
            <button
              aria-pressed={mode === "signup"}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}
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
              <p className="rounded-xl border border-error-border bg-error-surface p-3 text-sm text-error" role="alert">
                {localError ?? authError}
              </p>
            )}
            {message && (
              <p className="rounded-xl border border-success-border bg-success-surface p-3 text-sm text-success" role="status">
                {message}
              </p>
            )}

            <Button className="w-full" disabled={pending} type="submit">
              {pending ? "Procesando…" : mode === "signin" ? "Entrar a Fontex" : "Crear cuenta"}
              {!pending && <ArrowRight className="size-4" />}
            </Button>
          </form>
          <a className="mt-4 block text-center text-sm font-semibold text-primary underline" href="#/demo">Probar el aula de práctica</a>
        </Card>
      </div>
    </main>
  );
}

export function AuthLoadingPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <div className="text-center" role="status">
        <BrandMark />
        <p className="mt-5 text-sm text-muted-foreground">Verificando tu sesión…</p>
      </div>
    </main>
  );
}
