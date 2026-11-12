import { lessonSteps } from "./lesson-steps";
import { isExerciseIntent } from "./agent-intents";
import { modeDescriptions } from "./teaching-mode";
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
  { document, selectedId, onApply, authenticated = false, teachingLevel, onLevelChange, teachingMode, onModeChange, onSelect }: {
    document: StudioDocument;
    selectedId: string | null;
    onApply: (batch: ActionBatch, expected: StudioDocument) => boolean;
    authenticated?: boolean;
    onSelect?: (id: string | null) => void;
    teachingMode?: AgentMode;
    onModeChange?: (mode: AgentMode) => void;
    teachingLevel?: AgentLevel;
    onLevelChange?: (level: AgentLevel) => void;
  },
) {
  const [autonomous, setAutonomous] = useState(true);
  const currentDocument = useRef(document);
  useEffect(() => { currentDocument.current = document; }, [document]);
  const [applied, setApplied] = useState(false);
  const [source, setSource] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState("");
  const [localMode, setMode] = useState<AgentMode>("learn");
  const mode = teachingMode ?? localMode;
  const [localLevel, setLevel] = useState<AgentLevel>("primary");
  const level = teachingLevel ?? localLevel;
  const [explainStep, setExplainStep] = useState(1);
  const selectedObject = document.objects.find(o => o.id === selectedId);
  const stepCount = selectedObject ? lessonSteps(selectedObject, level).length : 0;
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
    setApplied(false);
    setError("");
    setHintLevel(0);
  }
  async function consult(event?: FormEvent, nextHint = 0, command?: string) {
    event?.preventDefault();
    if (pending.current) return;
    if (isExerciseIntent(command ?? question)) {
      if (!selectedObject || selectedObject.type === "text") { setError("Selecciona un módulo matemático para practicar."); return; }
      setMode("practice"); onModeChange?.("practice"); resetResponse(); return;
    }
    pending.current = true;
    const version = ++generation.current;
    const snapshot = structuredClone(document);
    setApplied(false);
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
        question: command ?? (question.trim() || "Ayúdame con el objeto seleccionado."),
        attempt,
        hintLevel: nextHint,
      });
      if (version !== generation.current) return;
      setReply(response);
      setReplyContext(contextKey);
      setHintLevel(nextHint);
      if (response.batch.actions.length) {
        executeActions(snapshot, response.batch);
        if (JSON.stringify(currentDocument.current) !== JSON.stringify(snapshot)) {
          throw new Error("El material cambió mientras trabajaba. Repite la consulta para usar el contexto actual.");
        }
        if (autonomous) {
          if (!onApply(response.batch, snapshot)) throw new Error("No se pudieron aplicar los cambios. El material sigue intacto.");
          setApplied(true);
        } else setProposal({ batch: response.batch, snapshot });
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
    <details className="st-agent" open>
      <summary>Fontex Agent</summary>
      <label className="st-autonomous"><input type="checkbox" checked={autonomous} disabled={busy} onChange={e => setAutonomous(e.target.checked)} />Aplicar cambios automáticamente</label>
      <p>Organiza el material y explica los pasos. Puedes deshacer cada intervención completa.</p>
      <p className="st-mode-description">{modeDescriptions[mode]}</p>
      {mode !== "practice" && <div className="st-agent-shortcuts" aria-label="Acciones sobre el módulo seleccionado">
        <button type="button" disabled={busy || !authenticated || !selectedObject} onClick={() => void consult(undefined, 0, "Haz más sencillo el módulo seleccionado para el nivel actual; conserva su tipo y explica la adaptación.")}>Más sencillo</button>
        <button type="button" disabled={busy || !authenticated || !selectedObject} onClick={() => void consult(undefined, 0, "Crea otro ejemplo del mismo tipo que el módulo seleccionado, con datos diferentes y sin modificar el original.")}>Otro ejemplo</button>
        <button type="button" disabled={busy || !selectedObject || selectedObject.type === "text"} onClick={() => void consult(undefined, 0, "Convierte el módulo seleccionado en ejercicio")}>Practicar esto</button>
        <label>Paso a explicar<input type="number" min={1} max={Math.max(1,stepCount)} value={Math.min(explainStep,Math.max(1,stepCount))} onChange={e => setExplainStep(Math.max(1,Number(e.target.value)||1))}/></label>
        <button type="button" disabled={busy || !stepCount} onClick={() => void consult(undefined, 0, `Explica solo el paso ${Math.min(explainStep,stepCount)}`)}>Explicar paso</button>
      </div>}

      <form onSubmit={(event) => void consult(event)}>
        <label>
          Modo<select
            value={mode}
            disabled={busy}
            onChange={(event) => {
              setMode(event.target.value as AgentMode);
              onModeChange?.(event.target.value as AgentMode);
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
              onLevelChange?.(event.target.value as AgentLevel);
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
        {mode === "practice" && onSelect && <label>Ejercicio del lienzo<select value={selectedId ?? ""} onChange={e => { onSelect(e.target.value || null); resetResponse(); }}><option value="">Selecciona un módulo</option>{document.objects.filter(o => o.type !== "text").map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>}
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
      {reply && (applied || replyContext === contextKey) && (
        <section aria-label="Orientación del agente" aria-live="polite">
          {applied && <p role="status">Cambios aplicados al lienzo. Puedes usar Deshacer.</p>}
          <p className="st-agent-message">{reply.message}</p>
          {reply.verification.length > 0 && (
            <details>
              <summary>Comprobación matemática exacta</summary>
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
