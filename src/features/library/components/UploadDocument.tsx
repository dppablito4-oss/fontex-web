import { FileCheck2, LoaderCircle, Plus, UploadCloud, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import type { StudyGroup } from "../../workspace/WorkspaceProvider";
import { preparePdfFile } from "../services/pdfService";
import type { DocumentLimits, PreparedPdf, UploadScope } from "../types";

function formatBytes(bytes: number) {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

export function UploadDocument({
  disabled,
  busy,
  groups,
  teacher,
  limits,
  onUpload,
}: {
  disabled: boolean;
  busy: boolean;
  groups: StudyGroup[];
  teacher: boolean;
  limits: DocumentLimits | null;
  onUpload: (prepared: PreparedPdf, scope: UploadScope) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [prepared, setPrepared] = useState<PreparedPdf | null>(null);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("private");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setPrepared(null);
    setTitle("");
    setScope("private");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setOpen(true);
    setValidating(true);
    setError(null);
    setPrepared(null);
    try {
      const next = await preparePdfFile(file);
      setPrepared(next);
      setTitle(next.title);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "No fue posible validar el PDF.");
    } finally {
      setValidating(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prepared) return;
    const uploadScope: UploadScope = scope === "classroom"
      ? { type: "classroom" }
      : scope.startsWith("group:")
        ? { type: "group", groupId: scope.slice(6) }
        : { type: "private" };
    try {
      await onUpload({ ...prepared, title: title.trim() }, uploadScope);
      reset();
    } catch {
      // The page-level feedback explains trusted backend failures.
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => void chooseFile(event)}
        tabIndex={-1}
      />
      <Button disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
        <Plus className="size-4" /> Añadir PDF
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--ui-overlay)] p-4 backdrop-blur-sm" role="presentation">
          <section
            aria-labelledby="upload-document-title"
            aria-modal="true"
            className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-[1.5rem] border border-border bg-surface p-5 shadow-2xl sm:p-7"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Carga protegida</p>
                <h2 id="upload-document-title" className="mt-1 text-xl font-semibold">Añadir documento PDF</h2>
              </div>
              <Button aria-label="Cerrar carga" disabled={busy} onClick={reset} size="icon" variant="ghost">
                <X className="size-5" />
              </Button>
            </div>

            {validating && (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-info bg-info-surface p-4 text-sm text-info-foreground" role="status">
                <LoaderCircle className="size-5 animate-spin" /> PDF.js está comprobando formato, páginas y texto seleccionable…
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl border border-error-border bg-error-surface p-4 text-sm text-error" role="alert">
                <strong className="block">No se puede usar este archivo</strong>
                <span className="mt-1 block">{error}</span>
                <Button className="mt-4" onClick={() => inputRef.current?.click()} size="sm" variant="secondary">Elegir otro PDF</Button>
              </div>
            )}

            {prepared && (
              <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)}>
                <div className="flex gap-3 rounded-2xl border border-success-border bg-success-surface p-4 text-success">
                  <FileCheck2 className="mt-0.5 size-5 shrink-0" />
                  <div className="min-w-0 text-sm">
                    <strong className="block truncate">{prepared.file.name}</strong>
                    <span className="mt-1 block text-xs">
                      {formatBytes(prepared.file.size)} MiB · {prepared.pageCount} páginas · texto seleccionable detectado
                    </span>
                  </div>
                </div>

                <label className="form-field">
                  <span>Título en la biblioteca</span>
                  <input
                    autoFocus
                    maxLength={180}
                    minLength={1}
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <span>Alcance inicial</span>
                  <select value={scope} onChange={(event) => setScope(event.target.value)}>
                    <option value="private">Privado · solo tú</option>
                    {groups.map((group) => (
                      <option key={group.id} value={`group:${group.id}`}>Grupo · {group.name}</option>
                    ))}
                    {teacher && <option value="classroom">Aula · todos los miembros activos</option>}
                  </select>
                </label>

                <div className="rounded-2xl border border-border bg-subtle p-4 text-xs leading-5 text-muted-foreground">
                  <strong className="block text-foreground">Controles aplicados</strong>
                  PDF, máximo {limits ? formatBytes(limits.maxFileBytes) : "5"} MiB y {limits?.maxPages ?? 100} páginas.
                  El navegador valida con PDF.js; el servidor vuelve a comprobar tamaño, firma y SHA-256 antes de almacenar.
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button disabled={busy} onClick={reset} type="button" variant="secondary">Cancelar</Button>
                  <Button disabled={busy || !title.trim()} type="submit">
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                    {busy ? "Subiendo…" : "Confirmar subida"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
