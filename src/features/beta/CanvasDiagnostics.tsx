import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../lib/supabase/client";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
const schema = z.object({ total: z.number(), completed: z.number(), refunded: z.number(), pending: z.number(), awaiting_application: z.number(), average_seconds: z.number().nullable() });
export function CanvasDiagnostics() {
  const [value, setValue] = useState<z.infer<typeof schema> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const result = await supabase.rpc("admin_canvas_diagnostics");
      if (result.error) throw Error();
      setValue(schema.parse(result.data)); setError("");
    } catch { setError("No se pudo consultar la actividad del lienzo."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void refresh(),0); return () => clearTimeout(timer); }, [refresh]);
  return <Card className="p-5 sm:p-7 space-y-3">
    <h2 className="text-xl font-semibold">Construcciones · últimas 24 horas</h2>
    {value && <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[["Solicitudes",value.total],["Completadas",value.completed],["Créditos devueltos",value.refunded],["En curso",value.pending],["Sin confirmar aplicación",value.awaiting_application],["Duración media",value.average_seconds === null ? "—" : `${value.average_seconds} s`]].map(([label,count]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-xl font-semibold">{count}</dd></div>)}
    </dl>}
    <p className="text-sm text-muted-foreground">Las métricas no muestran preguntas ni conversaciones. Los registros del servidor incluyen el identificador de solicitud para investigar incidencias.</p>
    {error && <p role="alert">{error}</p>}
    <Button variant="secondary" disabled={busy} onClick={() => void refresh()}>{busy ? "Consultando…" : "Actualizar actividad"}</Button>
  </Card>;
}
