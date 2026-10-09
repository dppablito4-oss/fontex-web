import { Share2, Trash2, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import type { StudyGroup } from "../../workspace/WorkspaceProvider";
import type { LibraryDocument, UploadScope } from "../types";

export function ShareDocument({
  document,
  groups,
  teacher,
  busy,
  onShare,
  onRevoke,
}: {
  document: LibraryDocument;
  groups: StudyGroup[];
  teacher: boolean;
  busy: boolean;
  onShare: (scope: Exclude<UploadScope, { type: "private" }>) => Promise<void>;
  onRevoke: (shareId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const groupNames = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const sharedGroupIds = new Set(document.shares.flatMap((share) => share.groupId ? [share.groupId] : []));
  const classroomShared = document.shares.some((share) => share.scopeType === "classroom");
  const availableGroups = groups.filter((group) => !sharedGroupIds.has(group.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    const scope = selection === "classroom"
      ? { type: "classroom" as const }
      : { type: "group" as const, groupId: selection };
    try {
      await onShare(scope);
      setSelection("");
    } catch {
      // Feedback is rendered by the library page.
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="secondary">
        <Share2 className="size-3.5" /> Acceso
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--ui-overlay)] p-4 backdrop-blur-sm" role="presentation">
          <section aria-labelledby={`share-${document.id}`} aria-modal="true" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-surface p-5 shadow-2xl sm:p-7" role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow">Permisos explícitos</p>
                <h2 id={`share-${document.id}`} className="mt-1 truncate text-xl font-semibold">{document.title}</h2>
              </div>
              <Button aria-label="Cerrar permisos" disabled={busy} onClick={() => setOpen(false)} size="icon" variant="ghost"><X className="size-5" /></Button>
            </div>

            <div className="mt-6 space-y-3">
              {document.shares.map((share) => (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-subtle p-3" key={share.id}>
                  <Badge tone={share.scopeType === "classroom" ? "green" : "blue"}>
                    {share.scopeType === "classroom" ? "Aula" : "Grupo"}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {share.scopeType === "classroom" ? "Todos los miembros activos" : groupNames.get(share.groupId ?? "") ?? "Grupo autorizado"}
                  </span>
                  <Button aria-label="Revocar acceso" disabled={busy} onClick={() => void onRevoke(share.id)} size="icon" variant="ghost"><Trash2 className="size-4" /></Button>
                </div>
              ))}
              {!document.shares.length && <p className="rounded-xl border border-border bg-subtle p-4 text-sm text-muted-foreground">Este documento es privado.</p>}
            </div>

            {(availableGroups.length > 0 || (teacher && !classroomShared)) && (
              <form className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row" onSubmit={(event) => void submit(event)}>
                <label className="form-field flex-1">
                  <span>Nuevo alcance</span>
                  <select required value={selection} onChange={(event) => setSelection(event.target.value)}>
                    <option value="">Seleccionar acceso</option>
                    {availableGroups.map((group) => <option key={group.id} value={group.id}>Grupo · {group.name}</option>)}
                    {teacher && !classroomShared && <option value="classroom">Aula completa</option>}
                  </select>
                </label>
                <Button className="sm:self-end" disabled={busy || !selection} type="submit">Compartir</Button>
              </form>
            )}

            <p className="mt-5 text-xs leading-5 text-muted-foreground">Revocar corta las nuevas lecturas inmediatamente. No se generan enlaces públicos.</p>
          </section>
        </div>
      )}
    </>
  );
}
