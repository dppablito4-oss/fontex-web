import { ArrowLeft, ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useAuth } from "./AuthProvider";

type Mode = "signin" | "signup";
export function AuthPage({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const { status, signIn, signUp, resendConfirmation, clearError, error: authError } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const configured = status !== 'unconfigured';
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  function switchMode(next: Mode) {
    setMode(next); setLocalError(null); setMessage(null); clearError(); setPassword(''); setConfirmPassword('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setMessage(null); setLocalError(null); clearError();
    if (mode === 'signup' && !displayName.trim()) { setLocalError('Escribe tu nombre visible.'); return; }
    if (mode === 'signup' && password !== confirmPassword) { setLocalError('Las contraseñas no coinciden.'); return; }
    setPending(true);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else {
        const requiresConfirmation = await signUp(displayName.trim(), email.trim(), password);
        if (requiresConfirmation) {
          setConfirmationEmail(email.trim());
          setMessage('Si el correo puede registrarse, recibirás un enlace para confirmar tu cuenta. Revisa tu bandeja y la carpeta de spam. Si ya tenías cuenta, inicia sesión.');
          setCooldown(60); setMode('signin'); setPassword(''); setConfirmPassword('');
        }
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'No fue posible completar la solicitud.';
      setLocalError(text);
      if (/confirma tu correo/i.test(text)) setConfirmationEmail(email.trim());
    } finally { setPending(false); }
  }
  async function resend() {
    const target = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { setLocalError('Escribe tu correo para solicitar el enlace de confirmación.'); return; }
    if (pending || cooldown) return;
    setPending(true); setLocalError(null); setMessage(null); clearError();
    try {
      await resendConfirmation(target);
      setConfirmationEmail(target); setCooldown(60);
      setMessage('Si hay una cuenta pendiente para ese correo, recibirás un nuevo enlace de confirmación. Revisa también spam.');
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'No fue posible enviar la confirmación.'); }
    finally { setPending(false); }
  }
  return <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-8">
    <header className="mx-auto flex max-w-5xl items-center justify-between"><a href="#/" aria-label="Volver al lienzo"><BrandMark/></a><ThemeToggle/></header>
    <div className="mx-auto mt-10 w-full max-w-md sm:mt-14"><div className="mb-6 text-center"><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Bienvenido a Fontex</h1></div>
      <Card className="p-6 sm:p-8"><div className="flex rounded-xl bg-subtle p-1" aria-label="Modo de acceso">
        <button aria-pressed={mode === 'signin'} disabled={pending} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'signin' ? 'bg-surface shadow-sm' : 'text-muted-foreground'}`} onClick={() => switchMode('signin')} type="button">Iniciar sesión</button>
        <button aria-pressed={mode === 'signup'} disabled={pending} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'signup' ? 'bg-surface shadow-sm' : 'text-muted-foreground'}`} onClick={() => switchMode('signup')} type="button">Crear cuenta</button>
      </div>
      {!configured && <p role="alert" className="mt-5 text-sm text-error">El acceso a cuentas no está disponible en esta versión. Puedes seguir usando el lienzo sin una cuenta.</p>}
      <form className="mt-7 space-y-5" onSubmit={event => void submit(event)}>
        <fieldset disabled={pending || !configured} className="space-y-5 border-0 p-0">
          {mode === 'signup' && <label className="form-field"><span>Nombre visible</span><input autoComplete="name" maxLength={80} minLength={1} onChange={event => setDisplayName(event.target.value)} required value={displayName}/></label>}
          <label className="form-field"><span>Correo</span><input autoComplete="email" onChange={event => { setEmail(event.target.value); setLocalError(null); clearError(); }} required type="email" value={email}/></label>
          <div><label className="form-field" htmlFor="auth-password"><span>Contraseña</span><input id="auth-password" aria-label="Contraseña" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} onChange={event => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={password}/>{mode === 'signup' && <small>Usa al menos 8 caracteres.</small>}</label><button type="button" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={14}/> : <Eye size={14}/>} {showPassword ? 'Ocultar' : 'Mostrar'}</button></div>
          {mode === 'signup' && <label className="form-field"><span>Confirmar contraseña</span><input autoComplete="new-password" minLength={8} onChange={event => setConfirmPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={confirmPassword}/></label>}
        </fieldset>
        {(localError ?? authError) && <p className="rounded-xl border border-error-border bg-error-surface p-3 text-sm text-error" role="alert">{localError ?? authError}</p>}
        {message && <div className="rounded-xl border border-success-border bg-success-surface p-3 text-sm text-success" role="status"><MailCheck size={19} className="mb-2"/>{message}</div>}
        <Button className="w-full" disabled={pending || !configured} type="submit">{pending ? 'Procesando…' : mode === 'signin' ? 'Entrar a Fontex' : 'Crear cuenta'}{!pending && <ArrowRight className="size-4"/>}</Button>
      </form>
      {mode === 'signin' && <div className="mt-5 text-center"><button type="button" disabled={pending || !configured || cooldown > 0} className="text-xs font-semibold text-primary underline disabled:opacity-50" onClick={() => void resend()}>{cooldown > 0 ? `Reenviar confirmación en ${cooldown} s` : 'Reenviar correo de confirmación'}</button>{confirmationEmail && <p className="mt-2 break-words text-xs text-muted-foreground">Confirma el correo indicado antes de entrar.</p>}</div>}
      <a className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-primary" href="#/"><ArrowLeft size={15}/> Continuar al lienzo sin cuenta</a>
      </Card>
    </div>
  </main>;
}
export function AuthLoadingPage() { return <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground"><div className="text-center" role="status"><BrandMark/><p className="mt-5 text-sm text-muted-foreground">Verificando tu sesión…</p></div></main>; }
