import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { classroomAccessError, classroomClient } from "./classroom-access";

const linkSchema = z.object({ id: z.string(), token: z.string(), code: z.string(), expires_at: z.string() });
const visitorsSchema = z.array(z.object({ id: z.string(), display_name: z.string(), expires_at: z.string() }));

export function ClassroomJoinPanel({ classroomId }: { classroomId: string }) {
  const [link, setLink] = useState<z.infer<typeof linkSchema> | null>(null);
  const [visitors, setVisitors] = useState<z.infer<typeof visitorsSchema>>([]);
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const url = link ? `${window.location.origin}${window.location.pathname}#/unirse?invite=${encodeURIComponent(link.token)}` : "";
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const { data, error: problem } = await classroomClient().rpc("list_classroom_guests", { p_classroom_id: classroomId });
      if (!alive) return;
      if (problem) { setError(classroomAccessError(Error(problem.message))); return; }
      setVisitors(visitorsSchema.parse(data));
    };
    void refresh().catch(() => { if (alive) setError("No se pudo actualizar la lista temporal."); });
    const timer = window.setInterval(() => { void refresh().catch(() => {}); }, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [classroomId]);
  async function change(revoke: boolean) {
    setPending(true); setError(""); setMessage("");
    try {
      if (revoke) {
        const { error: problem } = await classroomClient().rpc("revoke_classroom_join_link", { p_classroom_id: classroomId });
        if (problem) throw Error(problem.message);
        setLink(null); setMessage("El enlace y el código quedaron desactivados.");
      } else {
        const { data, error: problem } = await classroomClient().rpc("create_classroom_join_link", { p_classroom_id: classroomId });
        if (problem) throw Error(problem.message);
        setLink(linkSchema.parse(data)); setMessage("Invitación lista. Los enlaces y códigos anteriores quedaron desactivados.");
      }
      setVisitors([]);
    } catch (problem) { setError(classroomAccessError(problem)); }
    finally { setPending(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Copiado."); }
    catch { setError("No se pudo copiar automáticamente. Selecciona y copia el texto de la invitación."); }
  }
  return <Card className="space-y-4 p-5 sm:p-6">
    <h2 className="text-lg font-semibold">Invitar a la clase por enlace o código</h2>
    <p className="text-sm text-muted-foreground">Quienes tengan cuenta entran directamente. Los demás escriben su nombre y participan hasta 8 horas; después pueden completar su cuenta para permanecer. La invitación dura 7 días.</p>
    <div className="flex flex-wrap gap-2"><Button disabled={pending} onClick={() => void change(false)}>Generar nuevo enlace y código</Button><Button variant="secondary" disabled={pending} onClick={() => void change(true)}>Desactivar invitación</Button></div>
    <p className="text-xs text-muted-foreground">Renovar o desactivar finaliza los accesos temporales anteriores. Las matrículas permanentes se conservan.</p>
    {link && <div className="space-y-3 rounded-xl border border-border bg-subtle p-3">
      <p className="select-all break-all text-2xl font-bold tracking-wide">{link.code}</p>
      <p className="select-all break-all text-xs">{url}</p>
      <p className="text-xs">Vence: {new Date(link.expires_at).toLocaleString("es")}</p>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => void copy(url)}>Copiar enlace</Button><Button variant="secondary" size="sm" onClick={() => void copy(link.code)}>Copiar código</Button></div>
    </div>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {message && <p role="status" className="text-sm text-success">{message}</p>}
    <h3 className="font-semibold">Participantes temporales: {visitors.length}</h3>
    <ul className="space-y-2 text-sm">{visitors.map(guest => <li key={guest.id}>{guest.display_name} <span className="text-muted-foreground">· hasta {new Date(guest.expires_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span></li>)}</ul>
  </Card>;
}
