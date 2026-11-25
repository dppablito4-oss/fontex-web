import { Check, CircleX } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  assessmentKindLabel, type BrowserAssessment, loadBrowserAssessment, type StudentAnswer,
  submitBrowserAssessment, validAssessmentToken,
} from "./service";

async function browserIdentity(token: string) {
  const key = `fontex-assessment-browser-v1:${token}`;
  function getOrCreate() {
    try {
      const previous = localStorage.getItem(key);
      if (previous && validAssessmentToken(previous)) return previous;
      const id = crypto.randomUUID();
      localStorage.setItem(key, id);
      return id;
    } catch {
      throw Error("Permite que este navegador guarde datos del sitio para poder responder.");
    }
  }
  // Coordinate first-time access when the same evaluation opens in multiple tabs.
  return navigator.locks ? navigator.locks.request(key, getOrCreate) : getOrCreate();
}

export function StudentAssessmentPage({ token }: { token: string }) {
  const [form, setForm] = useState<BrowserAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<number, StudentAnswer>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const browserId = useRef<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    async function load(): Promise<BrowserAssessment> {
      if (!validAssessmentToken(token)) return { state: "closed" };
      browserId.current = await browserIdentity(token);
      return loadBrowserAssessment(token, browserId.current);
    }
    void load().then((result) => {
      if (active) setForm(result);
    }).catch((failure: unknown) => {
      if (active) setLoadError(failure instanceof Error ? failure.message : "No se pudo abrir el formulario.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token, attempt]);

  function reload() {
    setLoadError("");
    setLoading(true);
    setAttempt((current) => current + 1);
  }

  function toggleChoice(position: number, option: string) {
    setAnswers((current) => {
      const answer = current[position];
      const selected = Array.isArray(answer) ? answer : [];
      return {
        ...current,
        [position]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option],
      };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form?.state !== "open" || !browserId.current || submitting.current) return;
    const values = form.questions.map((question) => {
      const value = answers[question.position];
      return typeof value === "string" ? value.trim() : value ?? [];
    });
    const incomplete = values.findIndex((value) => !value.length);
    if (!name.trim() || incomplete !== -1) {
      setError(incomplete === -1 ? "Escribe tu nombre y apellidos." : `Completa la pregunta ${incomplete + 1}.`);
      return;
    }

    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const state = await submitBrowserAssessment(token, browserId.current, name.trim(), form.question_version, values);
      setAnswers({});
      if (state === "changed") {
        setError("Las preguntas se actualizaron. Revisa el formulario y responde la versión nueva.");
        reload();
      } else {
        setForm({ state, title: form.title });
        setName("");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo confirmar el envío.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const open = !loading && !loadError && form?.state === "open";
  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-2">
        <p className="eyebrow">Fontex {form?.state === "open" ? `· ${assessmentKindLabel[form.kind]}` : ""}</p>
        <h1 className="break-words text-3xl font-semibold">{form?.title ?? "Evaluación"}</h1>
        {open && form.description && <p className="whitespace-pre-wrap text-muted-foreground">{form.description}</p>}
      </header>
      {loading && <p role="status">Cargando evaluación…</p>}
      {loadError && <Card className="space-y-3 p-5">
        <p role="alert">{loadError}</p>
        <Button variant="secondary" onClick={reload}>Reintentar</Button>
      </Card>}
      {!loading && !loadError && form && form.state !== "open" && (
        <Card className="space-y-3 p-6 sm:p-8" role="status">
          {form.state === "submitted" ? <Check className="size-7 text-success" aria-hidden /> : <CircleX className="size-7 text-muted-foreground" aria-hidden />}
          <h2 className="text-xl font-semibold">
            {form.state === "submitted" ? "Gracias por tu participación" : "Gracias por entrar"}
          </h2>
          <p className="text-muted-foreground">
            {form.state === "submitted" ? "Tus respuestas ya están registradas." : "La evaluación cerró o el enlace ya venció."}
          </p>
        </Card>
      )}
      {open && <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Card className="space-y-3 p-5">
          <label className="form-field">
            <span>Nombres y apellidos</span>
            <input maxLength={100} autoComplete="name" required disabled={pending} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <p className="text-sm text-muted-foreground">Puedes enviar una sola vez desde este navegador.</p>
        </Card>
        {error && <p className="text-error" role="alert">{error}</p>}
        {form.questions.map((question, index) => {
          const answer = answers[question.position];
          const multiple = question.kind === "multiple";
          return <Card key={question.position} className="p-5">
            {question.kind !== "text" ? <fieldset disabled={pending} className="space-y-3">
              <legend className="mb-3 font-semibold">{index + 1}. {question.prompt}</legend>
              {multiple && <p className="text-sm text-muted-foreground">Marca todas las alternativas que correspondan.</p>}
              {question.options.map((option) => (
                <label key={option} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                  <input type={multiple ? "checkbox" : "radio"} className="mt-1" name={`question-${question.position}`} required={!multiple}
                    checked={multiple ? Array.isArray(answer) && answer.includes(option) : answer === option}
                    onChange={() => multiple
                      ? toggleChoice(question.position, option)
                      : setAnswers((current) => ({ ...current, [question.position]: option }))} />
                  <span className="min-w-0 break-words">{option}</span>
                </label>
              ))}
            </fieldset> : <label className="form-field">
              <span>{index + 1}. {question.prompt}</span>
              <textarea rows={4} maxLength={800} required disabled={pending} value={typeof answer === "string" ? answer : ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.position]: event.target.value }))} />
            </label>}
          </Card>;
        })}
        <Button disabled={pending} type="submit">{pending ? "Enviando…" : "Enviar respuestas"}</Button>
      </form>}
    </main>
  );
}
