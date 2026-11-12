import { useState } from "react";
import { executeActions, parseBatch, readStudioContext, type ActionBatch } from "../../core/agent/actions";
import type { StudioDocument } from "../../core/document-schema/document";
import { createObject } from "../../core/object-registry/registry";

type Proposal = { batch: ActionBatch; snapshot: StudioDocument };
export function StudioAgentPanel({ document, selectedId, onApply }: {
  document: StudioDocument;
  selectedId: string | null;
  onApply: (batch: ActionBatch, expected: StudioDocument) => boolean;
}) {
  const [source, setSource] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState("");
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
  return <details className="st-agent">
    <summary>Fontex Agent</summary>
    <details><summary>Contexto del material</summary><pre>{JSON.stringify(readStudioContext(document, selectedId), null, 2)}</pre></details>
    <button type="button" onClick={() => {
      setSource(JSON.stringify({ documentId: document.id, actions: [{ kind: "create", object: createObject("fraction", document.objects.length) }] }, null, 2));
      setProposal(null);
    }}>Preparar ejemplo</button>
    <label>Acciones estructuradas<textarea aria-label="Acciones estructuradas" rows={7} maxLength={100_000} value={source} onChange={event => { setSource(event.target.value); setProposal(null); }} /></label>
    <button type="button" onClick={preview}>Revisar acciones</button>
    {error && <p role="alert" className="st-error">{error}</p>}
    {proposal && <section aria-label="Vista previa de acciones">
      <ul>{proposal.batch.actions.map((action, index) => <li key={index}>{action.kind === "delete" ? `Eliminar: ${action.id}` : `${action.kind === "create" ? "Crear" : "Modificar"}: ${action.object.label} (${action.object.type})`}</li>)}</ul>
      <p>El lote se puede deshacer en un paso.</p>
      <button className="st-primary" type="button" onClick={() => {
        if (onApply(proposal.batch, proposal.snapshot)) { setProposal(null); setSource(""); }
      }}>Aplicar acciones</button>
    </section>}
  </details>;
}
