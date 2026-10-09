import { Copy, MailPlus, ShieldCheck, UserMinus, Users } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import type { ClassroomRole } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/AuthProvider";
import { PageHeader } from "../shared/PageHeader";
import { useWorkspace } from "../workspace/WorkspaceProvider";

function DemoClassroomPage() {
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Fundamentos de investigación · demostración"
        title="Tu aula"
        description="Vista ficticia del Bloque 0. Configura Supabase para administrar matrículas reales."
      />
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <Badge tone="orange">Datos ficticios</Badge>
          <h2 className="section-title mt-4">Del tema al problema de investigación</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Este contenido permanece como referencia visual y no modifica datos.</p>
        </Card>
        <Card className="p-6">
          <Users className="size-5 text-forest" />
          <strong className="mt-4 block text-xl">24 estudiantes simulados</strong>
          <p className="mt-2 text-sm text-muted">La matrícula real se habilita con las variables públicas de Supabase.</p>
        </Card>
      </div>
    </div>
  );
}

export function ClassroomPage() {
  const { status, user } = useAuth();
  const {
    activeClassroom,
    activeRole,
    members,
    loading,
    error,
    createWorkspace,
    createInvitation,
    acceptInvitation,
    removeClassroomMember,
    setMemberRole,
  } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [organizationName, setOrganizationName] = useState("");
  const [classroomTitle, setClassroomTitle] = useState("");
  const [term, setTerm] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [invitedRole, setInvitedRole] = useState<ClassroomRole>("student");
  const [invitationToken, setInvitationToken] = useState(() => searchParams.get("invite") ?? "");
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (status === "unconfigured") return <DemoClassroomPage />;

  async function run(action: () => Promise<void>, success: string) {
    setPending(true);
    setMessage(null);
    setLocalError(null);
    try {
      await action();
      setMessage(success);
    } catch (actionError) {
      setLocalError(actionError instanceof Error ? actionError.message : "No fue posible completar la acción.");
    } finally {
      setPending(false);
    }
  }

  function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      () => createWorkspace(organizationName, classroomTitle, term),
      "El aula se creó y tu perfil quedó registrado como docente.",
    ).then(() => {
      setOrganizationName("");
      setClassroomTitle("");
      setTerm("");
    });
  }

  function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setLocalError(null);
    setMessage(null);
    void createInvitation(invitedEmail, invitedRole)
      .then(({ token }) => {
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        setInvitationLink(`${baseUrl}#/aula?invite=${encodeURIComponent(token)}`);
        setInvitedEmail("");
        setMessage("Invitación creada. El enlace solo se muestra en esta sesión.");
      })
      .catch((actionError: unknown) => {
        setLocalError(actionError instanceof Error ? actionError.message : "No fue posible crear la invitación.");
      })
      .finally(() => setPending(false));
  }

  function submitAcceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      await acceptInvitation(invitationToken);
      setInvitationToken("");
      searchParams.delete("invite");
      setSearchParams(searchParams, { replace: true });
    }, "Invitación aceptada. Ya puedes acceder al aula.");
  }

  const owner = activeClassroom?.ownerId === user?.id;

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow={activeClassroom?.term ?? "Identidad, aulas y RLS"}
        title={activeClassroom?.title ?? "Tu aula"}
        description={activeClassroom
          ? "Matrícula, roles e invitaciones protegidos por políticas de base de datos."
          : "Crea un aula para docencia o acepta una invitación enviada a tu correo."}
        action={activeRole && <Badge tone="green"><ShieldCheck className="size-3" /> {activeRole === "teacher" ? "Docente" : "Estudiante"}</Badge>}
      />

      {(localError ?? error) && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{localError ?? error}</p>}
      {message && <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{message}</p>}
      {loading && <p className="mt-6 text-sm text-muted" role="status">Cargando aula…</p>}

      {!activeClassroom ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Card className="p-5 sm:p-7">
            <p className="eyebrow">Nuevo espacio</p>
            <h2 className="mt-2 text-xl font-semibold">Crear organización y aula</h2>
            <form className="mt-6 space-y-4" onSubmit={submitWorkspace}>
              <label className="form-field"><span>Institución u organización</span><input minLength={2} maxLength={120} required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></label>
              <label className="form-field"><span>Nombre del aula</span><input minLength={2} maxLength={120} required value={classroomTitle} onChange={(event) => setClassroomTitle(event.target.value)} /></label>
              <label className="form-field"><span>Periodo</span><input maxLength={40} placeholder="2026-II" value={term} onChange={(event) => setTerm(event.target.value)} /></label>
              <Button disabled={pending} type="submit">Crear aula</Button>
            </form>
          </Card>
          <AcceptInvitationCard
            pending={pending}
            token={invitationToken}
            onTokenChange={setInvitationToken}
            onSubmit={submitAcceptInvitation}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line p-5 sm:p-6">
              <div><p className="eyebrow">Matrícula activa</p><h2 className="mt-1 text-lg font-semibold">{members.length} integrantes</h2></div>
              <Users className="size-5 text-muted" />
            </div>
            {members.map((member) => (
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 last:border-0" key={member.userId}>
                <span className="grid size-9 place-items-center rounded-full bg-sage text-xs font-bold text-forest">{member.displayName.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{member.displayName}</strong><span className="text-xs text-muted">{member.role === "teacher" ? "Docente" : "Estudiante"}</span></div>
                {owner && member.userId !== activeClassroom.ownerId && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => void run(() => setMemberRole(member.userId, member.role === "teacher" ? "student" : "teacher"), "Rol actualizado.")}>
                      Cambiar a {member.role === "teacher" ? "estudiante" : "docente"}
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Retirar a ${member.displayName}`} onClick={() => void run(() => removeClassroomMember(member.userId), "Integrante retirado.")}><UserMinus className="size-4" /></Button>
                  </>
                )}
              </div>
            ))}
          </Card>

          <div className="space-y-5">
            {activeRole === "teacher" && (
              <Card className="p-5 sm:p-6">
                <MailPlus className="size-5 text-forest" />
                <h2 className="mt-3 text-lg font-semibold">Invitar por correo</h2>
                <form className="mt-5 space-y-4" onSubmit={submitInvitation}>
                  <label className="form-field"><span>Correo de la persona</span><input type="email" required value={invitedEmail} onChange={(event) => setInvitedEmail(event.target.value)} /></label>
                  <label className="form-field"><span>Rol asignado</span><select value={invitedRole} onChange={(event) => setInvitedRole(event.target.value as ClassroomRole)}><option value="student">Estudiante</option><option value="teacher">Docente</option></select></label>
                  <Button disabled={pending} type="submit">Crear invitación</Button>
                </form>
                {invitationLink && (
                  <div className="mt-5 rounded-xl border border-line bg-sage/60 p-3">
                    <p className="break-all text-xs text-muted">{invitationLink}</p>
                    <Button className="mt-3" size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(invitationLink)}><Copy className="size-3.5" /> Copiar enlace</Button>
                  </div>
                )}
              </Card>
            )}
            <AcceptInvitationCard pending={pending} token={invitationToken} onTokenChange={setInvitationToken} onSubmit={submitAcceptInvitation} />
          </div>
        </div>
      )}
    </div>
  );
}

function AcceptInvitationCard({
  pending,
  token,
  onTokenChange,
  onSubmit,
}: {
  pending: boolean;
  token: string;
  onTokenChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card className="p-5 sm:p-7">
      <p className="eyebrow">Matrícula por invitación</p>
      <h2 className="mt-2 text-xl font-semibold">Unirme a un aula</h2>
      <p className="mt-2 text-sm leading-6 text-muted">El correo de tu sesión debe coincidir con el correo invitado.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="form-field"><span>Token de invitación</span><input minLength={64} required value={token} onChange={(event) => onTokenChange(event.target.value)} /></label>
        <Button disabled={pending} type="submit">Aceptar invitación</Button>
      </form>
    </Card>
  );
}
