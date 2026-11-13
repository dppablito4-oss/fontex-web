import { useState, type FormEvent } from "react";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { supabase } from "../../lib/supabase/client";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useAuth } from "./AuthProvider";
import { confirmationRedirectUrl, readableAuthError } from "./auth-errors";

export function PasswordRecoveryPage({ updating = false }: { updating?: boolean }) {
  const { status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const ready = !!supabase && (!updating || status === "authenticated");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !ready || !supabase || done) return;
    setError("");
    if (updating && (password.length < 8 || password !== confirmation)) {
      setError(password.length < 8 ? "Usa al menos 8 caracteres." : "Las contraseñas no coinciden.");
      return;
    }
    setPending(true);
    try {
      const result = updating
        ? await supabase.auth.updateUser({ password })
        : await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: confirmationRedirectUrl() });
      if (result.error) throw result.error;
      setPassword("");
      setConfirmation("");
      setDone(true);
    } catch (failure) {
      setError(readableAuthError(failure));
    } finally {
      setPending(false);
    }
  }

  return <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-8">
    <header className="mx-auto flex max-w-5xl items-center justify-between">
      <a href="#/" aria-label="Volver a la presentación"><BrandMark /></a><ThemeToggle />
    </header>
    <Card className="mx-auto mt-10 w-full max-w-md p-6 sm:mt-14 sm:p-8">
      <h1 className="text-2xl font-bold">{updating ? "Elige una nueva contraseña" : "Recupera tu cuenta"}</h1>
      {done ? <div role="status" className="mt-5 space-y-4">
        <p>{updating ? "Tu contraseña se actualizó. Ya puedes continuar en Fontex." : "Si existe una cuenta con ese correo, recibirás un enlace para recuperar tu contraseña. Revisa también la carpeta de spam. El enlace es temporal y de un solo uso."}</p>
        <a className="font-semibold text-primary underline" href={updating ? "#/" : "#/ingresar"}>{updating ? "Continuar a Fontex" : "Volver al inicio de sesión"}</a>
      </div> : <>
        <p className="mt-3 text-sm text-muted-foreground">{updating ? "Usa al menos 8 caracteres y elige una contraseña que no hayas utilizado antes." : "Escribe el correo con el que creaste tu cuenta. Te enviaremos un enlace para elegir una nueva contraseña."}</p>
        {!supabase && <p role="alert" className="mt-4 text-error">La recuperación de cuentas no está disponible en esta versión.</p>}
        {updating && status !== "authenticated" && <p role="alert" className="mt-4 text-error">Abre el enlace que enviamos a tu correo. Si venció o ya se utilizó, <a href="#/recuperar-contrasena" className="underline">solicita uno nuevo</a>.</p>}
        <form onSubmit={event => void submit(event)} className="mt-6 space-y-5">
          <fieldset disabled={!ready || pending} className="space-y-5 border-0 p-0">
            {updating ? <>
              <label className="form-field"><span>Nueva contraseña</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
              <label className="form-field"><span>Confirmar nueva contraseña</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
            </> : <label className="form-field"><span>Correo</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
          </fieldset>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={!ready || pending}>{pending ? "Procesando…" : updating ? "Guardar nueva contraseña" : "Enviar enlace de recuperación"}</Button>
        </form>
        <a href="#/ingresar" className="mt-6 block text-center text-sm font-semibold text-primary underline">Volver al inicio de sesión</a>
      </>}
    </Card>
  </main>;
}
