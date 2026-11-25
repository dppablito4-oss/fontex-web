import { type FormEvent, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { type AssessmentKind, createAssessment, type QuestionKind } from "./service";

interface DraftQuestion {
  id: string;
  prompt: string;
  kind: QuestionKind;
  options: string;
}

function blankQuestion(): DraftQuestion {
  return { id: crypto.randomUUID(), prompt: "", kind: "text", options: "" };
}

export function AssessmentEditor({ onPublished, onCancel }: { onPublished: (id: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<AssessmentKind>("pretest");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => [blankQuestion()]);
  const [codeCount, setCodeCount] = useState("30");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const request = useRef<string | null>(null);
  const publishing = useRef(false);

  function update(id: string, change: Partial<DraftQuestion>) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...change } : question));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (publishing.current) return;
    const values = questions.map((question) => ({
      prompt: question.prompt.trim(),
      kind: question.kind,
      options: question.kind === "choice" ? question.options.split("\n").map((option) => option.trim()).filter(Boolean) : [],
    }));
    const invalid = values.findIndex((question) => !question.prompt || (question.kind === "choice" && (
      question.options.length < 2 || question.options.length > 8
      || question.options.some((option) => option.length > 180)
      || new Set(question.options).size !== question.options.length
    )));
    const count = Number(codeCount);
    if (!title.trim() || !Number.isInteger(count) || count < 1 || count > 200) {
      setError("Escribe un título y elige entre 1 y 200 códigos.");
      return;
    }
    if (invalid >= 0) {
      setError(`Revisa la pregunta ${invalid + 1}. Las preguntas de selección necesitan entre 2 y 8 opciones distintas.`);
      return;
    }

    request.current ??= crypto.randomUUID();
    publishing.current = true;
    setPending(true);
    setError("");
    try {
      const id = await createAssessment({
        request: request.current, title: title.trim(), kind, description: description.trim(), questions: values, codeCount: count,
      });
      onPublished(id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo publicar.");
    } finally {
      publishing.current = false;
      setPending(false);
    }
  }

  return <Card className="space-y-4 p-4 sm:p-6">
    <h3 className="font-semibold">Nueva evaluación</h3>
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <fieldset className="space-y-4" disabled={pending}>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <label className="form-field"><span>Título</span>
            <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="form-field"><span>Tipo</span>
            <select value={kind} onChange={(event) => setKind(event.target.value === "survey" ? "survey" : "pretest")}>
              <option value="pretest">Pretest</option><option value="survey">Encuesta</option>
            </select>
          </label>
        </div>
        <label className="form-field"><span>Indicaciones (opcional)</span>
          <textarea rows={3} maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="form-field max-w-xs"><span>Cantidad de códigos individuales</span>
          <input type="number" min={1} max={200} step={1} required value={codeCount} onChange={(event) => setCodeCount(event.target.value)} />
        </label>
        {questions.map((question, index) => <section key={question.id} aria-label={`Pregunta ${index + 1}`} className="space-y-3 rounded-lg border border-border p-4">
          <label className="form-field"><span>Pregunta {index + 1}</span>
            <input required maxLength={400} value={question.prompt} onChange={(event) => update(question.id, { prompt: event.target.value })} />
          </label>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="form-field"><span>Tipo de respuesta</span>
              <select value={question.kind} onChange={(event) => update(question.id, { kind: event.target.value === "choice" ? "choice" : "text" })}>
                <option value="text">Respuesta abierta</option><option value="choice">Selección única</option>
              </select>
            </label>
            {questions.length > 1 && <Button type="button" size="sm" variant="secondary"
              aria-label={`Quitar pregunta ${index + 1}`} onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}>Quitar</Button>}
          </div>
          {question.kind === "choice" && <label className="form-field">
            <span>Opciones, una por línea</span>
            <textarea rows={4} required maxLength={1447} value={question.options} onChange={(event) => update(question.id, { options: event.target.value })} />
          </label>}
        </section>)}
        <Button type="button" variant="secondary" disabled={questions.length >= 30} onClick={() => setQuestions((current) => [...current, blankQuestion()])}>Añadir pregunta</Button>
      </fieldset>
      <p className="text-sm text-muted-foreground">Al publicar puedes compartir el enlace o cerrar la recepción. Las preguntas publicadas quedan fijas para conservar el registro de las respuestas.</p>
      {error && <p className="text-error" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Publicando…" : "Publicar evaluación"}</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  </Card>;
}
