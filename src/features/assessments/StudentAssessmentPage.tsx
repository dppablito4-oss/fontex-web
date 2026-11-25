import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { assessmentKindLabel, loadPublicAssessment, type PublicAssessment, submitAssessment } from "./service";

export function StudentAssessmentPage({ token }: { token: string }) {
  const [form, setForm] = useState<PublicAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ code: string; id: string } | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    void loadPublicAssessment(token).then((result) => {
      if (active) setForm(result);
    }).catch((failure: unknown) => {
      if (active) setLoadError(failure instanceof Error ? failure.message : "No se pudo abrir el formulario.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token, attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || submitting.current) return;
    const studentCode = code.trim().toUpperCase();
    const values = form.questions.map((question) => answers[question.position]?.trim() ?? "");
    if (!name.trim() || !/^[0-9A-F]{12}$/.test(studentCode) || values.some((value) => !value)) {
      setError("Completa tu nombre, código y todas las respuestas.");
      return;
    }

    if (request.current?.code !== studentCode) {
      request.current = { code: studentCode, id: crypto.randomUUID() };
    }
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await submitAssessment(token, studentCode, name.trim(), request.current.id, values);
      setSubmitted(true);
      setAnswers({});
      setName("");
      setCode("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo confirmar el envío.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-2">
        <p className="eyebrow">Fontex {form ? `· ${assessmentKindLabel[form.kind]}` : ""}</p>
        <h1 className="text-3xl font-semibold">{form?.title ?? "Evaluación"}</h1>
        {form?.description && !submitted && <p className="whitespace-pre-wrap text-muted-foreground">{form.description}</p>}
      </header>
      {loading && <p role="status">Cargando preguntas…</p>}
      {loadError && <Card className="space-y-3 p-5">
        <p role="alert">{loadError}</p>
        <Button variant="secondary" onClick={() => {
          setLoadError("");
          setLoading(true);
          setAttempt((current) => current + 1);
        }}>Reintentar</Button>
      </Card>}
      {!loading && !loadError && !form?.is_open && <Card className="p-5">La evaluación está cerrada o el enlace no es válido.</Card>}
      {submitted && <Card className="space-y-2 p-6" role="status">
        <h2 className="text-xl font-semibold">Respuestas registradas</h2>
        <p>Tu docente ya puede revisar tu entrega.</p>
      </Card>}
      {form?.is_open && !submitted && <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Card className="space-y-4 p-5">
          <label className="form-field">
            <span>Nombres y apellidos</span>
            <input type="text" maxLength={100} autoComplete="name" required disabled={pending} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Código individual</span>
            <input type="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              autoComplete="off" maxLength={12} pattern="[0-9A-Fa-f]{12}" required disabled={pending}
              value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          </label>
          <p className="text-sm text-muted-foreground">Usa el código de 12 caracteres que te dio tu docente. Tu nombre y tus respuestas se guardan en su panel de evaluación.</p>
        </Card>
        {form.questions.map((question) => (
          <Card key={question.position} className="p-5">
            {question.kind === "choice"
              ? <fieldset disabled={pending} className="space-y-3">
                <legend className="mb-3 font-semibold">{question.position}. {question.prompt}</legend>
                {question.options.map((option) => (
                  <label key={option} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                    <input type="radio" className="mt-1" name={`question-${question.position}`} required
                      checked={answers[question.position] === option}
                      onChange={() => setAnswers((current) => ({ ...current, [question.position]: option }))} />
                    <span className="min-w-0 break-words">{option}</span>
                  </label>
                ))}
              </fieldset>
              : <label className="form-field">
                <span>{question.position}. {question.prompt}</span>
                <textarea rows={4} maxLength={800} required disabled={pending} value={answers[question.position] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.position]: event.target.value }))} />
              </label>}
          </Card>
        ))}
        {error && <p className="text-error" role="alert">{error}</p>}
        <Button disabled={pending} type="submit">{pending ? "Enviando…" : "Enviar respuestas"}</Button>
      </form>}
    </main>
  );
}
