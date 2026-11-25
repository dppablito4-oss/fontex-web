import { ClipboardCopy, Download, FileSpreadsheet, Printer, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { AssessmentEditor } from "./AssessmentEditor";
import { secondaryMathPretest } from "./assessment-templates";
import { AssessmentSheet } from "./AssessmentPrint";
import {
  type AssessmentCode, type AssessmentDetail, type AssessmentSummary, assessmentAnswerBatch,
  assessmentKindLabel, assessmentPageSize, deliveryDate, getAssessment, getAssessmentAnswers, listAssessments, setAssessmentOpen,
} from "./service";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AssessmentAdmin() {
  const [forms, setForms] = useState<AssessmentSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [listBusy, setListBusy] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<"blank" | "math" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAssessments(offset).then(({ forms: results, hasMore: more }) => {
      if (!active) return;
      setForms(results);
      setHasMore(more);
      setError("");
    }).catch((failure: unknown) => {
      if (active) setError(errorText(failure, "No se pudieron cargar las evaluaciones."));
    }).finally(() => {
      if (active) setListBusy(false);
    });
    return () => { active = false; };
  }, [offset, refresh]);

  function reload(start = offset) {
    setListBusy(true);
    setOffset(start);
    setRefresh((current) => current + 1);
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">Encuestas y pretest</h2>
        <p className="mt-1 text-sm text-muted-foreground">Crea un formulario, comparte su QR y revisa las entregas.</p>
      </div>
      {!editor && <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setEditor("math"); setSelected(null); }}>Cargar pretest de Matemática</Button>
        <Button variant="secondary" onClick={() => { setEditor("blank"); setSelected(null); }}>Nueva evaluación</Button>
      </div>}
    </div>
    {editor && <AssessmentEditor template={editor === "math" ? secondaryMathPretest : undefined}
      onCancel={() => setEditor(null)} onPublished={(id) => {
        setEditor(null);
        setSelected(id);
        reload(0);
      }} />}
    {!editor && selected && <AssessmentResults key={selected} id={selected} onChanged={() => reload()} />}
    {!editor && <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Tus evaluaciones</h3>
        <Button variant="secondary" size="sm" disabled={listBusy} onClick={() => reload()}>Actualizar lista</Button>
      </div>
      {error && <p className="text-error" role="alert">{error}</p>}
      {listBusy && <p role="status">Cargando evaluaciones…</p>}
      {!listBusy && !error && !forms.length && <p className="text-muted-foreground">Todavía no has publicado evaluaciones.</p>}
      {forms.length > 0 && <ul className="divide-y divide-border">
        {forms.map((form) => <li key={form.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="break-words font-semibold">{form.title}</p>
            <p className="text-sm text-muted-foreground">{assessmentKindLabel[form.kind]} · {form.is_open ? "Abierta" : "Cerrada"}</p>
          </div>
          <Button variant="secondary" size="sm" aria-pressed={selected === form.id}
            onClick={() => setSelected(selected === form.id ? null : form.id)}>{selected === form.id ? "Ocultar detalle" : "Abrir detalle"}</Button>
        </li>)}
      </ul>}
      {(offset > 0 || hasMore) && <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => reload(offset - assessmentPageSize)} disabled={listBusy || offset === 0}>Anterior</Button>
        <Button variant="secondary" size="sm" onClick={() => reload(offset + assessmentPageSize)} disabled={listBusy || !hasMore}>Siguiente</Button>
      </div>}
    </Card>}
  </section>;
}

function AssessmentResults({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [form, setForm] = useState<AssessmentDetail | null>(null);
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState("");
  const [student, setStudent] = useState<{ entry: AssessmentCode; answers: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [action, setAction] = useState<"state" | "xlsx" | "sheet" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const link = form ? `${window.location.origin}${window.location.pathname}#/evaluacion/${form.token}` : "";
  const completed = form?.codes.filter((item) => item.submitted_at !== null) ?? [];
  const available = form?.codes.filter((item) => item.submitted_at === null) ?? [];

  useEffect(() => {
    let active = true;
    void getAssessment(id).then((result) => {
      if (active) setForm(result);
    }).catch((failure: unknown) => {
      if (active) setError(errorText(failure, "No se pudo cargar el detalle."));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, refresh]);

  useEffect(() => {
    if (!link) return;
    let active = true;
    void import("qrcode").then(({ toDataURL }) => toDataURL(link, { width: 360, margin: 4, errorCorrectionLevel: "M" }))
      .then((image) => { if (active) setQr(image); })
      .catch(() => { if (active) setQrError("El QR no se pudo generar. Puedes copiar el enlace."); });
    return () => { active = false; };
  }, [link]);

  function reload() {
    setError("");
    setLoading(true);
    setRefresh((current) => current + 1);
  }

  async function copy(text: string, confirmation: string) {
    setMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(text);
      setMessage(confirmation);
    } catch {
      setError("Utiliza la selección de texto para copiar manualmente.");
    }
  }

  async function toggleOpen() {
    if (!form || action) return;
    const open = !form.is_open;
    setAction("state");
    setError("");
    try {
      await setAssessmentOpen(form.id, open);
      setForm({ ...form, is_open: open });
      onChanged();
      reload();
      setMessage(open ? "Evaluación abierta." : "Recepción de respuestas cerrada.");
    } catch (failure) {
      setError(errorText(failure, "No se pudo cambiar el estado."));
    } finally {
      setAction(null);
    }
  }

  async function showSheet(entry: AssessmentCode) {
    if (!form || action) return;
    setAction("sheet");
    setError("");
    setStudent(null);
    try {
      const [record] = await getAssessmentAnswers(form.id, [entry.code]);
      if (!record || record.answers.length !== form.questions.length) throw Error("No se encontró una entrega completa.");
      setStudent({ entry, answers: record.answers });
    } catch (failure) {
      setError(errorText(failure, "No se pudo abrir la ficha."));
    } finally {
      setAction(null);
    }
  }

  async function exportWorkbook() {
    if (!form || action) return;
    setAction("xlsx");
    setError("");
    setMessage("");
    try {
      const latest = await getAssessment(form.id);
      const codes = latest.codes.filter((item) => item.submitted_at !== null).map((item) => item.code);
      const answers = new Map<string, string[]>();
      for (let start = 0; start < codes.length; start += assessmentAnswerBatch) {
        const batch = codes.slice(start, start + assessmentAnswerBatch);
        for (const row of await getAssessmentAnswers(form.id, batch)) answers.set(row.code, row.answers);
      }
      if (codes.some((code) => answers.get(code)?.length !== latest.questions.length)) {
        throw Error("No se pudo completar la exportación. Actualiza las respuestas y vuelve a intentar.");
      }
      const { downloadAssessmentWorkbook } = await import("./assessment-export");
      await downloadAssessmentWorkbook(latest, answers);
      setForm(latest);
      setMessage("Archivo de Excel generado.");
    } catch (failure) {
      setError(errorText(failure, "No se pudo exportar el archivo."));
    } finally {
      setAction(null);
    }
  }

  return <Card className="space-y-5 p-4 sm:p-6">
    {!form && loading && <p role="status">Cargando evaluación…</p>}
    {error && <p className="text-error" role="alert">{error}</p>}
    {!form && !loading && <Button variant="secondary" onClick={reload}>Reintentar</Button>}
    {form && <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{assessmentKindLabel[form.kind]} · {form.is_open ? "Abierta" : "Cerrada"}</p>
          <h3 className="mt-1 break-words text-xl font-semibold">{form.title}</h3>
          <p className="text-sm text-muted-foreground">{form.questions.length} preguntas · {completed.length} de {form.codes.length} entregas</p>
        </div>
        <Button variant="secondary" disabled={action !== null || loading} onClick={() => void toggleOpen()}>
          {form.is_open ? "Cerrar recepción" : "Reabrir recepción"}
        </Button>
      </div>
      {message && <p className="text-success" role="status">{message}</p>}
      <div className="grid items-start gap-4 sm:grid-cols-[auto_1fr]">
        {qr && <img className="size-36 rounded-lg bg-white" src={qr} alt="QR del enlace para responder esta evaluación" width={144} height={144} />}
        <div className="min-w-0 space-y-3">
          <label className="form-field"><span>Enlace para estudiantes</span>
            <input value={link} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void copy(link, "Enlace copiado.")}><ClipboardCopy className="size-4" /> Copiar enlace</Button>
            <a className="px-2 py-2 text-sm font-semibold underline" href={link} target="_blank" rel="noreferrer">Abrir formulario</a>
            {qr && <a className="inline-flex items-center gap-2 px-2 py-2 text-sm font-semibold underline" href={qr} download="qr-evaluacion-fontex.png">
              <QrCode className="size-4" /> Descargar QR
            </a>}
          </div>
          {qrError && <p className="text-sm text-muted-foreground">{qrError}</p>}
        </div>
      </div>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer font-semibold">Códigos para repartir ({available.length} disponibles)</summary>
        <p className="mt-2 text-sm text-muted-foreground">Entrega un código distinto a cada estudiante. El mismo QR abre el formulario para todo el grupo.</p>
        {available.length > 0 && <>
          <label className="form-field mt-3"><span>Códigos disponibles</span>
            <textarea rows={4} value={available.map((item) => item.code).join("\n")} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() =>
            void copy(available.map((item) => item.code).join("\n"), "Códigos disponibles copiados.")}>
            <ClipboardCopy className="size-4" /> Copiar códigos
          </Button>
        </>}
      </details>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer font-semibold">Ver preguntas ({form.questions.length})</summary>
        <ol className="mt-2 list-decimal space-y-2 pl-6 text-sm">
          {form.questions.map((question) => <li key={question.position}>
            <strong>{question.prompt}</strong>
            <p className="text-muted-foreground">{question.kind === "choice" ? question.options.join(" / ") : "Respuesta abierta"}</p>
          </li>)}
        </ol>
      </details>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">Entregas de estudiantes</h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={loading || action !== null} onClick={reload}>Actualizar entregas</Button>
            <Button variant="secondary" size="sm" disabled={loading || action !== null || completed.length === 0}
              onClick={() => void exportWorkbook()}>
              <FileSpreadsheet className="size-4" /> {action === "xlsx" ? "Generando…" : "Exportar Excel"}
              {action !== "xlsx" && <Download className="size-3" aria-hidden />}
            </Button>
          </div>
        </div>
        {!completed.length
          ? <p className="text-muted-foreground">Todavía no hay entregas.</p>
          : <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-border">
                <th scope="col" className="p-2">Estudiante</th><th scope="col" className="p-2">Código</th>
                <th scope="col" className="p-2">Entrega</th><th scope="col" className="p-2">Ficha</th>
              </tr></thead>
              <tbody>{completed.map((entry) => <tr key={entry.code} className="border-b border-border">
                <td className="p-2">{entry.student_name}</td>
                <td className="p-2"><code>{entry.code}</code></td>
                <td className="p-2">{entry.submitted_at && deliveryDate(entry.submitted_at)}</td>
                <td className="p-2"><Button size="sm" variant="secondary" disabled={action !== null}
                  aria-label={`Ver ficha de ${entry.student_name}`} onClick={() => void showSheet(entry)}>Ver ficha</Button></td>
              </tr>)}</tbody>
            </table>
          </div>}
      </section>
      {student && <section className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Imprimir / guardar PDF</Button>
          <Button variant="secondary" size="sm" onClick={() => setStudent(null)}>Cerrar ficha</Button>
        </div>
        <AssessmentSheet form={form} {...student} />
        <AssessmentSheet form={form} {...student} printOnly />
      </section>}
    </>}
  </Card>;
}
