import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

export function AdminMfaGate({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [state, setState] = useState<"loading" | "enroll" | "verify" | "ready">("loading");
  const [factors, setFactors] = useState<{ id: string; name: string }[]>([]);
  const [factorId, setFactorId] = useState("");
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [verifiedOwner, setVerifiedOwner] = useState("");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!supabase || !user) return;
    const run = ++generation.current;
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (run !== generation.current) return;
    if (assurance.error) throw Error("No se pudo comprobar la verificación en dos pasos.");
    if (assurance.data.currentLevel === "aal2") { setVerifiedOwner(user.id); setState("ready"); setSetup(null); setCode(""); return; }
    const result = await supabase.auth.mfa.listFactors();
    if (run !== generation.current) return;
    if (result.error) throw Error("No se pudieron consultar los autenticadores.");
    const verified = result.data.totp.filter((f) => f.status === "verified").map((f) => ({ id: f.id, name: f.friendly_name || "Autenticador" }));
    setFactors(verified); setFactorId(verified[0]?.id ?? "");
    setState(verified.length ? "verify" : "enroll");
  }, [user]);
  useEffect(() => {
    const run = generation;
    const timer = setTimeout(() => void refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo comprobar la sesión.")),0);
    return () => { clearTimeout(timer); run.current++; };
  }, [refresh, session?.access_token]);
  async function enroll() {
    if (!supabase || pending) return;
    setPending(true); setError("");
    try {
      const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Fontex ${new Date().toISOString().slice(0,16)}`, issuer: "Fontex" });
      if (result.error) throw Error("No se pudo preparar el autenticador. Revisa la sesión y vuelve a intentarlo.");
      setFactorId(result.data.id); setSetup({ qr: result.data.totp.qr_code, secret: result.data.totp.secret }); setState("verify");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo activar el autenticador."); }
    finally { setPending(false); }
  }
  async function verify() {
    if (!supabase || pending || !/^\d{6}$/.test(code)) return;
    setPending(true); setError("");
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (result.error) throw Error("El código no es válido o venció. Escribe el código actual de tu autenticador.");
      setSetup(null); setCode(""); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo verificar el código."); }
    finally { setPending(false); }
  }
  async function cancelSetup() {
    if (!supabase || !setup || pending) return;
    setPending(true);
    const result = await supabase.auth.mfa.unenroll({ factorId });
    if (result.error) setError("No se pudo cancelar la configuración. Puedes completar la verificación con el código.");
    else { setSetup(null); setCode(""); setFactorId(""); setState("enroll"); }
    setPending(false);
  }
  if (state === "ready" && verifiedOwner === user?.id) return <>{children}</>;
  return <Card className="p-5 sm:p-7 space-y-4">
    <h2 className="text-xl font-semibold">Protege la administración</h2>
    <p>Para administrar invitaciones y créditos, verifica tu cuenta con una aplicación de autenticación.</p>
    {state === "loading" && <p role="status">Comprobando verificación…</p>}
    {state === "enroll" && <Button disabled={pending} onClick={() => void enroll()}>Configurar autenticador</Button>}
    {setup && <div className="space-y-3">
      <p>Escanea este código con tu aplicación de autenticación y escribe los seis dígitos.</p>
      <img src={setup.qr} alt="Código QR para vincular el autenticador de Fontex" width={220} height={220} />
      <details><summary>Introducir la clave manualmente</summary><code className="break-all select-all">{setup.secret}</code></details>
      <p className="text-sm">Conserva una copia segura del autenticador. Si pierdes el dispositivo, contacta al operador para recuperar el acceso administrativo.</p>
      <Button variant="secondary" disabled={pending} onClick={() => void cancelSetup()}>Cancelar configuración</Button>
    </div>}
    {state === "verify" && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
      {factors.length > 1 && <label className="form-field">Autenticador<select value={factorId} onChange={(e) => setFactorId(e.target.value)}>{factors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      <label className="form-field">Código del autenticador<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g,""))} required disabled={pending} /></label>
      <Button type="submit" disabled={pending || code.length !== 6}>{pending ? "Verificando…" : "Verificar y continuar"}</Button>
    </form>}
    {error && <div role="alert"><p>{error}</p><Button variant="secondary" disabled={pending} onClick={() => void refresh().catch(() => setError("No se pudo comprobar la sesión."))}>Reintentar comprobación</Button></div>}
  </Card>;
}
