import { ArrowUp, BookOpen, Lightbulb, Loader2, SlidersHorizontal, X } from "lucide-react";
import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import type { TutorCitation, TutorMessageRecord, TutorMode } from "../types";
import { AcademicMarkdown } from "./AcademicMarkdown";

const followUps = [
  ["Dame una pista", "Dame una pista progresiva sin revelarme la solución completa"],
  ["Un ejemplo más sencillo", "Explícamelo con un ejemplo más sencillo y cotidiano"],
  ["Otro ejercicio", "Proponme un ejercicio similar para poner a prueba mi comprensión"],
  ["Solución paso a paso", "Muéstrame la solución completa explicada paso a paso"],
] as const;

export function ChatArea({
  messages,
  sending,
  error,
  hasClassroom,
  mode,
  guided,
  onSetMode,
  onSetGuided,
  onSendMessage,
  onOpenCitation,
  onClearError,
}: {
  messages: TutorMessageRecord[];
  sending: boolean;
  error: string | null;
  hasClassroom: boolean;
  mode: TutorMode;
  guided: boolean;
  onSetMode: (mode: TutorMode) => void;
  onSetGuided: (guided: boolean) => void;
  onSendMessage: (text: string) => void;
  onOpenCitation: (citation: TutorCitation) => void;
  onClearError: () => void;
}) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = hasClassroom && !sending;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

  function handleSend() {
    const trimmed = inputText.trim();
    if (!trimmed || !canSend) return;
    onSendMessage(trimmed);
    setInputText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setInputText(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 150)}px`;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {error && (
        <div className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-2xl items-center justify-between gap-2 rounded-xl border border-error-border bg-error-surface px-3 py-2 text-sm text-error" role="alert">
          <span>{error}</span>
          <Button aria-label="Cerrar aviso" onClick={onClearError} size="icon" type="button" variant="ghost"><X className="size-4" /></Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {messages.length === 0 ? (
          <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center py-8 text-center">
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="size-5" /></span>
            <h2 className="text-xl font-bold tracking-tight">{hasClassroom ? "¿Qué quieres entender hoy?" : "Elige un aula para empezar"}</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{hasClassroom ? "Haz una pregunta y consulta las lecturas que respaldan la respuesta." : "Desde tu aula podrás conversar sobre tus lecturas."}</p>
            {hasClassroom
              ? <Button className="mt-4" disabled={!canSend} onClick={() => onSendMessage("¿Cuáles son los conceptos principales de las lecturas seleccionadas?")} size="sm" type="button" variant="secondary">Resumir mis lecturas</Button>
              : <Button asChild className="mt-4" size="sm" variant="secondary"><Link to="/aula">Ir a mis aulas</Link></Button>}
          </div>
        ) : (
          <ol aria-label="Conversación" className="mx-auto grid max-w-2xl gap-5 py-5">
            {messages.map((message) => (
              <li className={message.role === "user" ? "flex justify-end" : ""} key={message.id}>
                {message.role === "user"
                  ? <p className="max-w-[88%] rounded-2xl rounded-br-sm bg-primary/10 px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</p>
                  : <div className="min-w-0 [overflow-wrap:anywhere]">
                      <p className="mb-1.5 text-xs font-bold text-muted-foreground">Fontex</p>
                      <AcademicMarkdown content={message.content} citations={message.citations ?? []} onOpenCitation={onOpenCitation} />
                    </div>}
              </li>
            ))}
          </ol>
        )}
        {sending && <p className="mx-auto flex max-w-2xl items-center gap-2 pb-4 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin text-primary" /> Preparando una respuesta…</p>}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 px-4 pt-2 pb-4">
        <div className="mx-auto max-w-2xl">
          {messages.length > 0 && (
            <details className="mb-2 text-xs text-muted-foreground">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-subtle"><Lightbulb className="size-4" /> Ayuda para continuar</summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {followUps.map(([label, prompt]) => <Button disabled={!canSend} key={label} onClick={() => onSendMessage(prompt)} size="sm" type="button" variant="ghost">{label}</Button>)}
              </div>
            </details>
          )}
          <form className="flex items-end gap-1 rounded-2xl border border-border bg-surface p-2 focus-within:border-primary" onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
            <details className="relative shrink-0">
              <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-xl text-muted-foreground hover:bg-subtle" title="Opciones de tutoría" aria-label="Opciones de tutoría">
                <SlidersHorizontal className="size-4" />
              </summary>
              <div className="absolute bottom-full left-0 z-10 mb-2 w-56 space-y-2 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg">
                <label className="grid gap-1.5 text-xs font-semibold">Respuesta
                  <select className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" onChange={(event) => onSetMode(event.target.value === "strict" ? "strict" : "comparative")} value={mode}>
                    <option value="strict">Solo mis fuentes</option>
                    <option value="comparative">Con contexto adicional</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 py-1 text-sm"><input checked={guided} className="accent-primary" onChange={(event) => onSetGuided(event.target.checked)} type="checkbox" /> Tutoría guiada</label>
              </div>
            </details>
            <textarea aria-label="Tu pregunta" className="min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60" disabled={!canSend} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Escribe tu pregunta…" ref={textareaRef} rows={1} value={inputText} />
            <Button aria-label="Enviar pregunta" className="size-9 shrink-0 rounded-xl" disabled={!inputText.trim() || !canSend} size="icon" type="submit"><ArrowUp className="size-5" /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}
