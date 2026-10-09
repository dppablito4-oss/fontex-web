import { Database, Gauge, LockKeyhole, LogOut, Save, Settings2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "../auth/AuthProvider";
import { PageHeader } from "../shared/PageHeader";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const demoItems = [
  { icon: LockKeyhole, title: "Identidad y permisos", detail: "Configura Supabase para activar el Bloque 1", tone: "orange" as const },
  { icon: Database, title: "Almacenamiento", detail: "Reservado para el Bloque 2", tone: "neutral" as const },
  { icon: Gauge, title: "Cuotas del aula", detail: "Valores de demostración", tone: "blue" as const },
  { icon: Settings2, title: "Configuración general", detail: "Interfaz inicial", tone: "green" as const },
];

export function AdminPage() {
  const { status, profile, user, updateDisplayName, signOut } = useAuth();
  const { activeClassroom, activeRole } = useWorkspace();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === "unconfigured") {
    return (
      <div className="page-wrap">
        <PageHeader eyebrow="Configuración" title="Administración" description="Vista demostrativa. Ninguna acción modifica datos reales sin configurar Supabase." />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {demoItems.map(({ icon: Icon, title, detail, tone }) => (
            <Card key={title} className="flex items-center gap-4 p-5 sm:p-6">
              <span className="metric-icon"><Icon /></span>
              <div className="flex-1"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{detail}</p></div>
              <Badge tone={tone}>Demo</Badge>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      await updateDisplayName(displayName);
      setMessage("Perfil actualizado.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No fue posible actualizar el perfil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Configuración segura" title="Administración" description="Gestiona tu identidad. Los roles del aula no se guardan en metadatos editables por el usuario." />
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="p-5 sm:p-7">
          <p className="eyebrow">Perfil</p>
          <h2 className="mt-2 text-xl font-semibold">{profile?.displayName ?? "Usuario Fontex"}</h2>
          <p className="mt-1 text-sm text-muted">{user?.email}</p>
          <form className="mt-6 space-y-4" onSubmit={(event) => void submitProfile(event)}>
            <label className="form-field"><span>Nombre visible</span><input minLength={1} maxLength={80} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            {message && <p className="text-sm text-emerald-700" role="status">{message}</p>}
            <div className="flex flex-wrap gap-3">
              <Button disabled={pending} type="submit"><Save className="size-4" /> Guardar perfil</Button>
              <Button onClick={() => void signOut()} type="button" variant="secondary"><LogOut className="size-4" /> Cerrar sesión</Button>
            </div>
          </form>
        </Card>
        <div className="space-y-4">
          <Card className="flex items-center gap-4 p-5">
            <span className="metric-icon"><LockKeyhole /></span>
            <div className="flex-1"><h2 className="font-semibold">Identidad y RLS</h2><p className="mt-1 text-sm text-muted">Activos en Supabase</p></div>
            <Badge tone="green">Real</Badge>
          </Card>
          <Card className="flex items-center gap-4 p-5">
            <span className="metric-icon"><Settings2 /></span>
            <div className="flex-1"><h2 className="font-semibold">Aula activa</h2><p className="mt-1 text-sm text-muted">{activeClassroom?.title ?? "Sin aula"} · {activeRole === "teacher" ? "Docente" : activeRole === "student" ? "Estudiante" : "Sin rol"}</p></div>
          </Card>
          <Card className="flex items-center gap-4 p-5">
            <span className="metric-icon"><Database /></span>
            <div className="flex-1"><h2 className="font-semibold">Biblioteca y Storage</h2><p className="mt-1 text-sm text-muted">Pendientes del Bloque 2</p></div>
            <Badge tone="neutral">Pendiente</Badge>
          </Card>
        </div>
      </div>
    </div>
  );
}
