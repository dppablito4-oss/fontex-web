import {
  AlertCircle,
  Bot,
  BrainCircuit,
  Compass,
  CornerDownLeft,
  Lightbulb,
  Loader2,
  Lock,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import type {
  TutorCitation,
  TutorHealthStatus,
  TutorMessageRecord,
  TutorMode,
} from "../types";
import { AcademicMarkdown } from "./AcademicMarkdown";

export function ChatArea({
  messages,
  sending,
  error,
  health,
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
  health: TutorHealthStatus;
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;
    onSendMessage(trimmed);
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGuidedAction = (promptText: string) => {
    if (sending) return;
    onSendMessage(promptText);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Auto-expand textarea
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Header: Modes, Guided Toggle, and Honest Health Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        {/* Mode Selectors */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-subtle p-0.5">
            <button
              type="button"
              onClick={() => onSetMode("strict")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                mode === "strict"
                  ? "bg-surface text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Modo Estricto: Respuestas fundamentadas únicamente en los documentos seleccionados"
            >
              <Lock className="size-3.5" />
              Modo Estricto
            </button>
            <button
              type="button"
              onClick={() => onSetMode("comparative")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                mode === "comparative"
                  ? "bg-surface text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Modo Comparativo: Complementa los documentos con explicaciones generales diferenciadas"
            >
              <Sparkles className="size-3.5" />
              Modo Comparativo
            </button>
          </div>

          {/* Guided Tutoring Toggle */}
          <button
            type="button"
            onClick={() => onSetGuided(!guided)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-medium transition-all ${
              guided
                ? "border-primary/50 bg-primary/10 text-primary font-semibold"
                : "border-border bg-subtle text-muted-foreground hover:text-foreground"
            }`}
            title="Tutoría Guiada: Hace preguntas socráticas, ofrece pistas progresivas y propone ejercicios"
          >
            <Compass className="size-3.5" />
            Tutoría Guiada
            {guided && <span className="ml-0.5 text-[10px] text-primary">● Activa</span>}
          </button>
        </div>

        {/* Honest Health Status Indicator */}
        <div className="flex items-center gap-2">
          {health.available ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>IA conectada ({health.model})</span>
            </div>
          ) : health.configured ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <span className="size-2 rounded-full bg-amber-500" />
              <span>Servicio en mantenimiento</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-stone-500/10 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-full bg-stone-400" />
              <span>Modo Demostración</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onClearError}
            className="rounded p-1 hover:bg-rose-500/20"
            title="Cerrar aviso"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl text-center py-12">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <BrainCircuit className="size-6" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Tutor Académico Documental
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Haz preguntas fundamentadas en los PDFs de tu aula. El tutor extraerá fragmentos
              pertinentes, verificará las referencias y te indicará las páginas exactas.
            </p>

            <div className="mt-8 grid gap-2.5 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Sugerencias de estudio
              </p>
              <button
                type="button"
                onClick={() =>
                  handleGuidedAction(
                    "Explícame la segunda ley de Newton y cómo resolver un ejercicio aplicándola",
                  )
                }
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs text-foreground transition-all hover:border-primary/50 hover:bg-subtle"
              >
                <span>«Explícame la segunda ley de Newton y cómo resolver un ejercicio aplicándola»</span>
                <CornerDownLeft className="size-3.5 text-muted-foreground opacity-60" />
              </button>
              <button
                type="button"
                onClick={() =>
                  handleGuidedAction(
                    "¿Cuáles son las fórmulas o conceptos principales descritos en los documentos seleccionados?",
                  )
                }
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs text-foreground transition-all hover:border-primary/50 hover:bg-subtle"
              >
                <span>«¿Cuáles son las fórmulas o conceptos principales descritos en los documentos seleccionados?»</span>
                <CornerDownLeft className="size-3.5 text-muted-foreground opacity-60" />
              </button>
              <button
                type="button"
                onClick={() =>
                  handleGuidedAction(
                    "Proponme un ejercicio práctico basado en las lecturas de esta semana con pistas progresivas",
                  )
                }
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs text-foreground transition-all hover:border-primary/50 hover:bg-subtle"
              >
                <span>«Proponme un ejercicio práctico con pistas progresivas»</span>
                <CornerDownLeft className="size-3.5 text-muted-foreground opacity-60" />
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";

            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="flex max-w-2xl items-start gap-2.5">
                    <div className="rounded-2xl rounded-tr-xs bg-primary px-4 py-3 text-sm text-primary-foreground shadow-xs">
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <User className="size-4" />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex justify-start">
                <div className="flex max-w-3xl items-start gap-3">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                    <Bot className="size-4" />
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-xs border border-border bg-surface p-4 shadow-xs">
                    <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          Tutor Fontex
                        </span>
                        {msg.model && (
                          <Badge tone="neutral" className="text-[10px] text-muted-foreground">
                            {msg.model}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <AcademicMarkdown
                      content={msg.content}
                      citations={msg.citations ?? []}
                      onOpenCitation={onOpenCitation}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-3 rounded-2xl rounded-tl-xs border border-border bg-surface px-4 py-3 shadow-xs">
              <Loader2 className="size-4 animate-spin text-primary" />
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Consultando fuentes académicas…</span>
                <span className="block text-[11px]">Validando fragmentos y fundamentando respuesta</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Guided Quick Actions Toolbar */}
      <div className="border-t border-border bg-surface/80 px-4 py-2 backdrop-blur-xs">
        <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
          <span className="flex items-center gap-1 font-semibold text-[11px] text-muted-foreground shrink-0">
            <Lightbulb className="size-3 text-amber-500" />
            Pistas:
          </span>
          <button
            type="button"
            disabled={sending}
            onClick={() => handleGuidedAction("Dame una pista progresiva sin revelarme la solución completa")}
            className="inline-flex shrink-0 items-center rounded-lg border border-border bg-subtle px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-surface disabled:opacity-50"
          >
            💡 Dame una pista
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => handleGuidedAction("Explícamelo con un ejemplo más sencillo y cotidiano")}
            className="inline-flex shrink-0 items-center rounded-lg border border-border bg-subtle px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-surface disabled:opacity-50"
          >
            🔍 Explícalo más sencillo
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => handleGuidedAction("Proponme un ejercicio similar para poner a prueba mi comprensión")}
            className="inline-flex shrink-0 items-center rounded-lg border border-border bg-subtle px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-surface disabled:opacity-50"
          >
            📝 Proponme un ejercicio
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => handleGuidedAction("Muéstrame la solución completa explicada paso a paso")}
            className="inline-flex shrink-0 items-center rounded-lg border border-border bg-subtle px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-surface disabled:opacity-50"
          >
            ✅ Solución completa
          </button>
        </div>
      </div>

      {/* Input Composer */}
      <div className="border-t border-border bg-surface p-4">
        <div className="relative rounded-2xl border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-xs">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "strict"
                ? "Haz una pregunta sobre los documentos seleccionados (Modo Estricto)..."
                : "Haz una pregunta académica (Modo Comparativo)..."
            }
            disabled={sending}
            className="w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
          />

          <div className="flex items-center justify-between border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="text-[11px]">
              Presiona <kbd className="rounded border bg-subtle px-1 py-0.5 text-[10px]">Enter</kbd> para enviar,{" "}
              <kbd className="rounded border bg-subtle px-1 py-0.5 text-[10px]">Shift+Enter</kbd> para salto de línea
            </span>

            <Button
              type="button"
              size="sm"
              disabled={!inputText.trim() || sending}
              onClick={handleSend}
              className="gap-1.5 rounded-xl px-3 font-semibold shadow-xs"
            >
              {sending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Razonando…</span>
                </>
              ) : (
                <>
                  <span>Enviar</span>
                  <CornerDownLeft className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
