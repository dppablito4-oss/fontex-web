import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type ActionBatch,
  executeActions,
  parseBatch,
  readStudioContext,
} from "../../core/agent/actions";
import type { StudioDocument } from "../../core/document-schema/document";
import { createObject } from "../../core/object-registry/registry";
import {
  type AgentLevel,
  agentLevels,
  type AgentMode,
  agentModes,
  type AgentReply,
} from "../../core/agent/protocol";
import { requestAgent } from "./agentService";

type Proposal = { batch: ActionBatch; snapshot: StudioDocument };
export function StudioAgentPanel(
  { document, selectedId, onApply, authenticated = false }: {
    document: StudioDocument;
    selectedId: string | null;
    onApply: (batch: ActionBatch, expected: StudioDocument) => boolean;
    authenticated?: boolean;
  },
) {
  const [source, setSource] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<AgentMode>("learn");
  const [level, setLevel] = useState<AgentLevel>("primary");
  const [question, setQuestion] = useState("");
  const [attempt, setAttempt] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [reply, setReply] = useState<AgentReply | null>(null);
  const [replyContext, setReplyContext] = useState("");
  const contextKey = JSON.stringify([document, selectedId]);
  const proposalIsCurrent = !!proposal &&
    JSON.stringify(document) === JSON.stringify(proposal.snapshot);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => () => {
    generation.current++;
  }, []);
  function resetResponse() {
    generation.current++;
    setProposal(null);
    setReply(null);
    setError("");
    setHintLevel(0);
  }
  async function consult(event?: FormEvent, nextHint = 0) {
    event?.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const version = ++generation.current;
    const snapshot = structuredClone(document);
    setBusy(true);
    setError("");
    setProposal(null);
    setReply(null);
    try {
      const response = await requestAgent({
        document: snapshot,
        selectedId,
        mode,
        level,
        question: question.trim() || "Ayúdame con el objeto seleccionado.",
        attempt,
        hintLevel: nextHint,
      });
      if (version !== generation.current) return;
      setReply(response);
      setReplyContext(contextKey);
      setHintLevel(nextHint);
      if (response.batch.actions.length) {
        setProposal({ batch: response.batch, snapshot });
      }
    } catch (e) {
      if (version === generation.current) {
        setError(
          e instanceof Error ? e.message : "El agente no está disponible.",
        );
      }
    } finally {
      pending.current = false;
      if (version === generation.current) setBusy(false);
    }
  }
  function preview() {
    try {
      const batch = parseBatch(JSON.parse(source));
      executeActions(document, batch);
      setProposal({ batch, snapshot: structuredClone(document) });
      setError("");
    } catch (e) {
      setProposal(null);
      setError(e instanceof Error ? e.message : "Acciones inválidas.");
    }
  }
  return (
    <details className="st-agent">
      <summary>Fontex Agent</summary>
      <form onSubmit={(event) => void consult(event)}>
        <label>
          Modo<select
            value={mode}
            disabled={busy}
            onChange={(event) => {
              setMode(event.target.value as AgentMode);
              resetResponse();
            }}
          >
            {Object.entries(agentModes).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Nivel<select
            value={level}
            disabled={busy}
            onChange={(event) => {
              setLevel(event.target.value as AgentLevel);
              resetResponse();
            }}
          >
            {Object.entries(agentLevels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {mode !== "practice" && (
          <label>
            Consulta<textarea
              rows={3}
              maxLength={1200}
              value={question}
              disabled={busy}
              onChange={(event) => {
                setQuestion(event.target.value);
                resetResponse();
              }}
            />
          </label>
        )}
        {mode === "practice" && (
          <label>
            Tu respuesta<input
              value={attempt}
              maxLength={1200}
              disabled={busy}
              onChange={(event) => {
                setAttempt(event.target.value);
                resetResponse();
              }}
            />
          </label>
        )}
        {mode !== "practice" && !authenticated && (
          <p>
            <a href="#/ingresar">Inicia sesión</a> para consultar la IA.
          </p>
        )}
        <button
          className="st-primary"
          type="submit"
          disabled={busy || (mode !== "practice" && !authenticated)}
        >
          {busy
            ? "Preparando…"
            : mode === "practice"
            ? "Comprobar y orientar"
            : "Consultar"}
        </button>
      </form>
      {reply && replyContext === contextKey && (
        <section aria-label="Orientación del agente" aria-live="polite">
          <p className="st-agent-message">{reply.message}</p>
          {reply.verification.length > 0 && (
            <details>
              <summary>Comprobación con MathEngine</summary>
              <ul>
                {reply.verification.map((text, i) => <li key={i}>{text}</li>)}
              </ul>
            </details>
          )}
          {mode === "practice" && (
            <button
              type="button"
              disabled={busy || hintLevel >= 2}
              onClick={() => void consult(undefined, hintLevel + 1)}
            >
              {hintLevel >= 2 ? "Comprobación mostrada" : "Otra pista"}
            </button>
          )}
        </section>
      )}
      <details>
        <summary>Acciones locales</summary>
        <details>
          <summary>Contexto del material</summary>
          <pre>{JSON.stringify(readStudioContext(document, selectedId), null, 2)}</pre>
        </details>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setSource(
              JSON.stringify(
                {
                  documentId: document.id,
                  actions: [{
                    kind: "create",
                    object: createObject("fraction", document.objects.length),
                  }],
                },
                null,
                2,
              ),
            );
            setProposal(null);
          }}
        >
          Preparar ejemplo
        </button>
        <label>
          Acciones estructuradas<textarea
            aria-label="Acciones estructuradas"
            rows={7}
            maxLength={100_000}
            value={source}
            disabled={busy}
            onChange={(event) => {
              setSource(event.target.value);
              setProposal(null);
            }}
          />
        </label>
        <button type="button" disabled={busy} onClick={preview}>
          Revisar acciones
        </button>
      </details>
      {error && <p role="alert" className="st-error">{error}</p>}
      {proposal && (
        <section aria-label="Vista previa de acciones">
          <ul>
            {proposal.batch.actions.map((action, index) => (
              <li key={index}>
                {action.kind === "delete"
                  ? `Eliminar: ${
                    proposal.snapshot.objects.find((object) =>
                      object.id === action.id
                    )?.label ?? action.id
                  }`
                  : `${
                    action.kind === "create" ? "Crear" : "Modificar"
                  }: ${action.object.label} (${action.object.type})`}
                {action.kind !== "delete" && (
                  <details>
                    <summary>Valores propuestos</summary>
                    <pre>{JSON.stringify(action.object, null, 2)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
          <p>El lote se puede deshacer en un paso.</p>
          {!proposalIsCurrent && (
            <p role="status">El material cambió. Prepara otra propuesta.</p>
          )}
          <button
            className="st-primary"
            type="button"
            disabled={!proposalIsCurrent}
            onClick={() => {
              if (onApply(proposal.batch, proposal.snapshot)) {
                setProposal(null);
                setSource("");
              }
            }}
          >
            Aplicar acciones
          </button>
        </section>
      )}
    </details>
  );
}
