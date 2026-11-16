import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../../components/ProductNavigation";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "../auth/AuthProvider";
import { useClassroomGuest } from "./classroom-guest-context";
import { adoptClassroomCanvases, saveClassroomCanvases, classroomAccessError, classroomClient, guestSchema, inviteValue, storeClassroomGuest } from "./classroom-access";

export function JoinClassroomPage() {
  const [params] = useSearchParams(), navigate = useNavigate();
  const { status, user, signIn, signUp, resendConfirmation } = useAuth();
  const { guest, active, checking } = useClassroomGuest();
  const [invite, setInvite] = useState(params.get("invite") ?? "");
  const [resolved, setResolved] = useState(params.get("invite") ?? "");
  const [attempt, setAttempt] = useState(0);
  const [title, setTitle] = useState("");
  const [name, setName] = useState(guest?.display_name ?? "");
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [upgrading, setUpgrading] = useState(params.has("conservar"));
  const [pending, setPending] = useState(params.has("invite")), [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const autoJoined = useRef("");

  useEffect(() => {
    if (!resolved) return;
    let alive = true;
    void (async () => {
      try {
        const { data, error: problem } = await classroomClient().rpc("get_classroom_join_info", { p_invite: resolved });
        if (!alive) return;
        if (problem) throw Error(problem.message);
        if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.title !== "string") throw Error("classroom_invite_expired");
        setTitle(data.title);
      } catch (problem) { if (alive) setError(classroomAccessError(problem)); }
      finally { if (alive) setPending(false); }
    })();
    return () => { alive = false; };
  }, [resolved, attempt]);

  // Existing accounts redeem links immediately, including accounts invited to
  // Fontex for the first time by their teacher. No global beta gate before this.
  useEffect(() => {
    if (!user || !title || !resolved || autoJoined.current === resolved) return;
    let alive = true;
    const timer = window.setTimeout(() => { autoJoined.current = resolved; setPending(true); setError(""); void (async () => {
      const { data, error: problem } = await classroomClient().rpc("join_classroom_by_invite", { p_invite: resolved });
      if (!alive) return;
      if (problem) { setError(classroomAccessError(Error(problem.message))); setPending(false); return; }
      sessionStorage.setItem("fontex-active-classroom", String(data));
      void navigate("/aula", { replace: true });
    })().catch(() => { if (alive) { setError("No pudimos unir tu cuenta. Vuelve a intentarlo."); setPending(false); } }); }, 0);
    return () => { alive = false; clearTimeout(timer); autoJoined.current = ""; };
  }, [user, title, resolved, navigate]);

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError("");
    try {
      const { data, error: problem } = await classroomClient().rpc("start_classroom_guest", { p_invite: resolved, p_name: name.trim() });
      if (problem) throw Error(problem.message);
      storeClassroomGuest(guestSchema.parse(data));
      setResolved(""); setTitle("");
      void navigate("/aula", { replace: true });
    } catch (problem) { setError(classroomAccessError(problem)); }
    finally { setPending(false); }
  }

  async function finish() {
    if (!guest || !user || pending) return;
    setPending(true); setError("");
    try {
      const { data, error: problem } = await classroomClient().rpc("complete_classroom_guest", { p_token: guest.token });
      if (problem) throw Error(problem.message);
      const copies=adoptClassroomCanvases(guest,user.id);
      await saveClassroomCanvases(user.id,copies);
      sessionStorage.setItem("fontex-active-classroom", String(data));
      storeClassroomGuest(null);
      void navigate("/aula", { replace: true });
    } catch (problem) { setError(problem instanceof Error && /biblioteca|copia|subir|guardado/.test(problem.message) ? problem.message : classroomAccessError(problem)); }
    finally { setPending(false); }
  }

  async function account(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guest || pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      if (mode === "signin") await signIn(email, password);
      else {
        const confirmation = await signUp(guest.display_name, email, password, guest.token);
        if (confirmation) setMessage("Revisa tu correo y confirma la cuenta. Después vuelve aquí para conservar tu trabajo y tu matrícula. Tu copia local sigue disponible en este navegador.");
      }
      setPassword("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "No se pudo completar tu cuenta."); }
    finally { setPending(false); }
  }

  return <main className="min-h-dvh bg-background text-foreground">
    <SiteHeader />
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      <Card className="space-y-5 p-5 sm:p-8">
        <h1 className="text-2xl font-bold">{title || (guest ? guest.title : "Unirme a un aula")}</h1>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        {message && <p role="status" className="text-sm text-success">{message}</p>}
        {status === "loading" && <p role="status">Comprobando tu sesión…</p>}
        {title && !user && status !== "loading" && <form className="space-y-5" onSubmit={event => { void enter(event); }}>
          <p>Participa en la clase escribiendo solo tu nombre. Tu acceso temporal dura hasta 8 horas e incluye 5 créditos de IA para crear lienzos. Al terminar puedes crear tu cuenta para guardar y permanecer en el aula.</p>
          <label className="form-field"><span>Tu nombre</span><input autoComplete="name" required minLength={1} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
          <Button type="submit" disabled={pending || !name.trim()}>Entrar a la clase</Button>
          <a className="block text-sm text-primary underline" href={`#/ingresar?volver=${encodeURIComponent(`/unirse?invite=${encodeURIComponent(resolved)}`)}`}>Ya tengo cuenta: iniciar sesión</a>
        </form>}
        {title && user && <p role="status">{pending ? "Uniendo tu cuenta al aula…" : "No se completó la incorporación."}{!pending && <Button onClick={() => { setTitle(""); setPending(true); setAttempt(value => value + 1); }}>Reintentar</Button>}</p>}
        {!title && guest && <>
          <p><strong>{guest.display_name}</strong> · {checking ? "Comprobando acceso…" : active ? "Estás en el aula temporalmente." : "Tu participación temporal finalizó."}</p>
          <p className="text-sm text-muted-foreground">Vincula tu correo y confírmalo para conservar tus actividades, tus lienzos y el saldo restante. Recibirás 5 créditos adicionales una sola vez y permanecerás en el aula.</p>
          <a className="inline-block font-semibold text-primary underline" href="#/lienzo">{active ? "Abrir mi lienzo" : "Recuperar mi copia local"}</a>
          {!upgrading && !user && <Button onClick={() => setUpgrading(true)}>Guardar y permanecer en el aula</Button>}
          {(upgrading || !!user) && (user ? <Button disabled={pending} onClick={() => void finish()}>Conservar mis lienzos y mi matrícula</Button> : <form className="space-y-4" onSubmit={event => { void account(event); }}>
            <h2 className="text-lg font-semibold">{mode === "signup" ? "Completar mi cuenta" : "Acceder a mi cuenta"}</h2>
            <label className="form-field"><span>Correo</span><input required autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label className="form-field"><span>Contraseña</span><input required minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "signup" ? "new-password" : "current-password"} type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
            <Button disabled={pending || (mode === "signup" && !active)} type="submit">{mode === "signup" ? "Crear mi cuenta" : "Iniciar sesión"}</Button>
            <button type="button" disabled={pending} className="block text-sm text-primary underline" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setPassword(""); }}>{mode === "signup" ? "Ya tengo una cuenta" : "Crear una cuenta nueva"}</button>
            {message && <button type="button" disabled={pending} className="text-sm text-primary underline" onClick={() => { setPending(true); void resendConfirmation(email).then(() => setMessage("Confirmación reenviada. Revisa tu correo.")).catch(e => setError(String(e))).finally(() => setPending(false)); }}>Reenviar confirmación</button>}
          </form>)}
        </>}
        {!title && <form className="space-y-4 border-t border-border pt-5" onSubmit={e => { e.preventDefault(); setError(""); setPending(true); setResolved(inviteValue(invite)); setAttempt(value => value + 1); }}>
          <label className="form-field"><span>Código o enlace del aula</span><input autoCapitalize="characters" autoComplete="off" spellCheck={false} required maxLength={2048} placeholder="AB12-CD34-EF56" value={invite} onChange={e => setInvite(e.target.value)} /></label>
          <Button disabled={pending || status === "loading"} type="submit">Buscar aula</Button>
          {!guest && <p className="text-sm text-muted-foreground">Pide el código o el enlace a tu docente. Si ya iniciaste sesión, te unirás con tu cuenta.</p>}
        </form>}
      </Card>
    </div>
  </main>;
}
