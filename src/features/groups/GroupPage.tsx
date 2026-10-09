import { Plus, UserMinus, UsersRound } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "../auth/AuthProvider";
import { PageHeader } from "../shared/PageHeader";
import {
  type ClassroomMember,
  type GroupMembership,
  type StudyGroup,
  useWorkspace,
} from "../workspace/WorkspaceProvider";

function DemoGroupPage() {
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Grupo 04 · demostración" title="Horizonte" description="Los integrantes y documentos de esta vista son ficticios." />
      <Card className="mt-8 p-6">
        <Badge tone="orange">Datos ficticios</Badge>
        <h2 className="mt-4 text-lg font-semibold">4 integrantes simulados</h2>
        <p className="mt-2 text-sm text-muted-foreground">Configura Supabase para crear grupos y asignar matrículas reales.</p>
      </Card>
    </div>
  );
}

export function GroupPage() {
  const { status } = useAuth();
  const {
    activeClassroom,
    activeRole,
    members,
    groups,
    groupMemberships,
    error,
    createGroup,
    addGroupMember,
    removeGroupMember,
  } = useWorkspace();
  const [groupName, setGroupName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (status === "unconfigured") return <DemoGroupPage />;

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

  function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => createGroup(groupName), "Grupo creado.").then(() => setGroupName(""));
  }

  if (!activeClassroom) {
    return (
      <div className="page-wrap">
        <PageHeader eyebrow="Grupos privados" title="Mi grupo" description="Primero crea un aula o acepta una invitación desde la sección Aula." />
        <Card className="mt-8 p-6 text-sm text-muted-foreground">No hay un aula activa.</Card>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow={activeClassroom.title}
        title="Grupos de estudio"
        description="Solo integrantes activos del aula pueden ver sus grupos; las asignaciones requieren rol docente."
        action={activeRole === "teacher" ? <Badge tone="green">Gestión docente</Badge> : <Badge tone="blue">Vista de estudiante</Badge>}
      />

      {(localError ?? error) && <p className="mt-6 rounded-xl border border-error-border bg-error-surface p-3 text-sm text-error" role="alert">{localError ?? error}</p>}
      {message && <p className="mt-6 rounded-xl border border-success-border bg-success-surface p-3 text-sm text-success" role="status">{message}</p>}

      {activeRole === "teacher" && (
        <Card className="mt-8 p-5 sm:p-6">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={submitGroup}>
            <label className="form-field flex-1"><span>Nombre del nuevo grupo</span><input minLength={2} maxLength={80} required value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label>
            <Button disabled={pending} type="submit"><Plus className="size-4" /> Crear grupo</Button>
          </form>
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {groups.map((group) => (
          <GroupCard
            disabled={pending}
            group={group}
            key={group.id}
            memberships={groupMemberships}
            members={members}
            teacher={activeRole === "teacher"}
            onAdd={(userId) => run(() => addGroupMember(group.id, userId), "Integrante asignado al grupo.")}
            onRemove={(userId) => run(() => removeGroupMember(group.id, userId), "Integrante retirado del grupo.")}
          />
        ))}
        {!groups.length && <Card className="p-6 text-sm text-muted-foreground">Todavía no hay grupos en esta aula.</Card>}
      </div>
    </div>
  );
}

function GroupCard({
  group,
  memberships,
  members,
  teacher,
  disabled,
  onAdd,
  onRemove,
}: {
  group: StudyGroup;
  memberships: GroupMembership[];
  members: ClassroomMember[];
  teacher: boolean;
  disabled: boolean;
  onAdd: (userId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}) {
  const assignedIds = new Set(memberships.filter((item) => item.groupId === group.id).map((item) => item.userId));
  const assignedMembers = members.filter((member) => assignedIds.has(member.userId));
  const availableMembers = members.filter((member) => !assignedIds.has(member.userId));
  const [selectedUserId, setSelectedUserId] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) return;
    void onAdd(selectedUserId).then(() => setSelectedUserId(""));
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div><p className="eyebrow">Grupo privado</p><h2 className="mt-1 text-lg font-semibold">{group.name}</h2></div>
        <span className="flex items-center gap-2 text-sm text-muted-foreground"><UsersRound className="size-4" /> {assignedMembers.length}</span>
      </div>
      <div className="p-5">
        <div className="space-y-3">
          {assignedMembers.map((member) => (
            <div className="flex items-center gap-3" key={member.userId}>
              <span className="grid size-8 place-items-center rounded-full bg-info-surface text-xs font-bold text-info-foreground">{member.displayName.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{member.displayName}</span>
              {teacher && <Button aria-label={`Retirar a ${member.displayName} de ${group.name}`} disabled={disabled} onClick={() => void onRemove(member.userId)} size="icon" variant="ghost"><UserMinus className="size-4" /></Button>}
            </div>
          ))}
          {!assignedMembers.length && <p className="text-sm text-muted-foreground">Sin integrantes asignados.</p>}
        </div>
        {teacher && availableMembers.length > 0 && (
          <form className="mt-5 flex gap-2 border-t border-border pt-5" onSubmit={submit}>
            <label className="form-field flex-1"><span className="sr-only">Integrante para {group.name}</span><select required value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Seleccionar integrante</option>{availableMembers.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</select></label>
            <Button disabled={disabled || !selectedUserId} size="sm" type="submit">Asignar</Button>
          </form>
        )}
      </div>
    </Card>
  );
}
