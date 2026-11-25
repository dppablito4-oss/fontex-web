import { ClipboardCopy, FileSpreadsheet, Plus, Printer, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { AssessmentEditor } from "./AssessmentEditor";
import { type AssessmentTemplate, secondaryMathPretest } from "./assessment-templates";
import { AssessmentScore } from "./AssessmentScore";
import { AssessmentSheet } from "./AssessmentPrint";
import {
  type AssessmentCode, type AssessmentDetail, type AssessmentSummary, assessmentAnswerBatch,
  assessmentKindLabel, assessmentPageSize, deleteAssessment, deleteAssessmentQuestion, deliveryDate, getAssessment,
  getAssessmentAnswers, listAssessments, loadTicsPretest, loadUniversityPretest, questionKindLabel, setAssessmentOpen,
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
  const [editor, setEditor] = useState<AssessmentTemplate | "blank" | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState("");
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

  async function openTemplate(load: () => Promise<AssessmentTemplate>) {
    setTemplateBusy(true);
    setTemplateError("");
    try {
      setEditor(await load());
      setSelected(null);
    } catch (failure) {
      setTemplateError(errorText(failure, "No se pudo cargar la plantilla de Fontex."));
    } finally {
      setTemplateBusy(false);
    }
  }

  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold">Encuestas y pretest</h2>
        <p className="mt-1 text-sm text-muted-foreground">Crea un formulario, comparte su QR y revisa las entregas.</p>
      </div>
      {!editor && <div className="flex flex-wrap gap-2">
        <Button disabled={templateBusy} onClick={() => { setTemplateError(""); setEditor("blank"); setSelected(null); }}><Plus className="size-4" aria-hidden /> Nueva evaluación</Button>
        <Button disabled={templateBusy} onClick={() => void openTemplate(loadTicsPretest)}>
          {templateBusy ? "Cargando plantilla…" : "Cargar Pretest TICs 1"}
        </Button>
        <Button disabled={templateBusy} variant="secondary" onClick={() => void openTemplate(loadUniversityPretest)}>
          {templateBusy ? "Cargando plantilla…" : "Cargar pretest universitario de Fontex"}
        </Button>
        <Button disabled={templateBusy} variant="secondary" onClick={() => { setTemplateError(""); setEditor(secondaryMathPretest); setSelected(null); }}>
          Cargar pretest de Matemática
        </Button>
      </div>}
    </div>
    {templateError && <p className="text-error" role="alert">{templateError}</p>}
    {editor && <AssessmentEditor template={editor === "blank" ? undefined : editor}
      onCancel={() => setEditor(null)} onPublished={(id) => {
        setEditor(null);
        setSelected(id);
        reload(0);
      }} />}
    {!editor && selected && <AssessmentResults key={selected} id={selected} onChanged={() => reload()} onDeleted={() => {
      setSelected(null);
      reload(0);
    }} />}
    {!editor && <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Tus evaluaciones</h3>
        <Button variant="ghost" size="sm" disabled={listBusy} onClick={() => reload()}><RefreshCw className="size-4" aria-hidden /> Actualizar lista</Button>
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

function AssessmentResults({ id, onChanged, onDeleted }: { id: string; onChanged: () => void; onDeleted: () => void }) {
  const [form, setForm] = useState<AssessmentDetail | null>(null);
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState("");
  const [student, setStudent] = useState<{ entry: AssessmentCode; answers: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [action, setAction] = useState<"state" | "xlsx" | "sheet" | "delete" | "question" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const link = form ? `${window.location.origin}${window.location.pathname}#/evaluacion/${form.token}` : "";
  const completed = form?.codes.filter((item) => item.submitted_at !== null) ?? [];

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


  async function removeForm() {
    if (!form || action || !window.confirm(`¿Eliminar «${form.title}»? Se eliminarán también sus preguntas y entregas.`)) return;
    setAction("delete");
    setError("");
    try {
      await deleteAssessment(form.id);
      onDeleted();
    } catch (failure) {
      setError(errorText(failure, "No se pudo eliminar la evaluación."));
    } finally {
      setAction(null);
    }
  }

  async function removeQuestion(position: number, index: number) {
    if (!form || action || !window.confirm(`¿Eliminar la pregunta ${index + 1}? También se eliminarán las respuestas a esa pregunta.`)) return;
    setAction("question");
    setError("");
    setMessage("");
    try {
      await deleteAssessmentQuestion(form.id, position);
      setStudent(null);
      reload();
      setMessage("Pregunta eliminada.");
    } catch (failure) {
      setError(errorText(failure, "No se pudo eliminar la pregunta."));
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

  return <Card className="space-y-6 p-4 sm:p-6">
    {!form && loading && <p role="status">Cargando evaluación…</p>}
    {error && <p className="text-error" role="alert">{error}</p>}
    {!form && !loading && <Button variant="secondary" onClick={reload}>Reintentar</Button>}
    {form && <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">{assessmentKindLabel[form.kind]}</p>
            <span className={form.is_open ? "rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
              : "rounded-full bg-subtle px-2.5 py-1 text-xs text-muted-foreground"}>
              {form.is_open ? "Abierta" : "Cerrada"}
            </span>
          </div>
          <h3 className="mt-1 break-words text-xl font-semibold">{form.title}</h3>
          <p className="text-sm text-muted-foreground">{form.questions.length} preguntas · {completed.length} entregas</p>
        </div>
        <Button variant={form.is_open ? "secondary" : "primary"} disabled={action !== null || loading} onClick={() => void toggleOpen()}>
          {form.is_open ? "Cerrar recepción" : "Reabrir recepción"}
        </Button>
      </div>
      {message && <p className="text-success" role="status">{message}</p>}
      <section className="grid items-start gap-4 rounded-xl border border-border bg-subtle/40 p-4 sm:grid-cols-[auto_1fr] sm:p-5" aria-label="Compartir evaluación">
        {qr && <img className="size-36 rounded-lg bg-white" src={qr} alt="QR del enlace para responder esta evaluación" width={144} height={144} />}
        <div className="min-w-0 space-y-3">
          <h4 className="font-semibold">Compartir con estudiantes</h4>
          <p className="text-sm text-muted-foreground">El QR abre el formulario. Cada navegador admite una entrega.</p>
          <label className="form-field"><span>Enlace para estudiantes</span>
            <input value={link} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copy(link, "Enlace copiado.")}><ClipboardCopy className="size-4" aria-hidden /> Copiar enlace</Button>
            {qr && <Button variant="secondary" size="sm" asChild>
              <a href={qr} download="qr-evaluacion-fontex.png"><QrCode className="size-4" aria-hidden /> Descargar QR</a>
            </Button>}
            <Button variant="ghost" size="sm" asChild><a href={link} target="_blank" rel="noreferrer">Abrir formulario</a></Button>
          </div>
          {qrError && <p className="text-sm text-muted-foreground">{qrError}</p>}
        </div>
      </section>
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Preguntas ({form.questions.length})</summary>
        <ol className="mt-3 divide-y divide-border">
          {form.questions.map((question, index) => <li className="flex flex-wrap items-start justify-between gap-3 py-3" key={question.position}>
            <div className="min-w-0 flex-1 break-words text-sm">
              <strong>{index + 1}. {question.prompt}</strong>
              <p className="mt-1 text-muted-foreground">{questionKindLabel[question.kind]}</p>
              {question.options.length > 0 && <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {question.options.map((option) => <li key={option}>{option}</li>)}
              </ul>}
            </div>
            <Button variant="ghost" size="sm" className="hover:text-error" disabled={loading || action !== null || form.questions.length === 1 || form.graded}
              aria-label={`Eliminar pregunta ${index + 1}`} onClick={() => void removeQuestion(question.position, index)}>
              <Trash2 className="size-4" aria-hidden /> Eliminar
            </Button>
          </li>)}
        </ol>
        {form.graded && <p className="text-xs text-muted-foreground">El pretest calificado conserva las diez preguntas para que los puntajes sean comparables.</p>}
        {form.questions.length === 1 && <p className="text-xs text-muted-foreground">La evaluación debe conservar una pregunta.</p>}
      </details>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">Entregas de estudiantes</h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" disabled={loading || action !== null} onClick={reload}>
              <RefreshCw className="size-4" aria-hidden /> Actualizar
            </Button>
            <Button variant="secondary" size="sm" disabled={loading || action !== null || completed.length === 0}
              onClick={() => void exportWorkbook()}>
              <FileSpreadsheet className="size-4" /> {action === "xlsx" ? "Generando…" : "Exportar Excel"}
            </Button>
          </div>
        </div>
        {!completed.length
          ? <p className="text-muted-foreground">Todavía no hay entregas.</p>
          : <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-border">
                <th scope="col" className="p-2">Estudiante</th>
                <th scope="col" className="p-2">Entrega</th>{form.graded && <th scope="col" className="p-2">Resultado</th>}<th scope="col" className="p-2">Ficha</th>
              </tr></thead>
              <tbody>{completed.map((entry) => <tr key={entry.code} className="border-b border-border">
                <td className="p-2">{entry.student_name}</td>
                <td className="p-2">{entry.submitted_at && deliveryDate(entry.submitted_at)}</td>
                {form.graded && <td className="p-2">{entry.score != null && <AssessmentScore score={entry.score} />}</td>}
                <td className="p-2"><Button size="sm" variant="ghost" disabled={action !== null}
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
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Gestionar evaluación</summary>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Eliminar la evaluación borra el enlace y todas sus entregas.</p>
          <Button variant="danger" size="sm" disabled={loading || action !== null} onClick={() => void removeForm()}>
            <Trash2 className="size-4" aria-hidden /> Eliminar evaluación
          </Button>
        </div>
      </details>
    </>}
  </Card>;
}
