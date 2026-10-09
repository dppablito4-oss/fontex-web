import { BookOpenText, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { searchDocumentChunks } from "../services/documentService";
import type { RagSearchResult, RagSearchScope } from "../types";

function pageLabel(result: RagSearchResult) {
  return result.pageStart === result.pageEnd ? `p. ${result.pageStart}` : `pp. ${result.pageStart}–${result.pageEnd}`;
}

export function RagSearchPanel() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<RagSearchScope>("all");
  const [results, setResults] = useState<RagSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 3) {
      setError("Escribe al menos 3 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResults(await searchDocumentChunks(normalized, scope));
      setSearched(true);
    } catch (searchError) {
      setResults([]);
      setSearched(false);
      setError(searchError instanceof Error ? searchError.message : "No fue posible buscar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-8 overflow-hidden">
      <div className="border-b border-border bg-subtle p-5 sm:flex sm:items-start sm:justify-between sm:gap-5">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-info-surface text-info-foreground">
            <BookOpenText className="size-4" />
          </span>
          <div>
            <h2 className="font-semibold">Diagnóstico de recuperación RAG</h2>
            <p className="text-xs text-muted-foreground">Busca únicamente en fragmentos indexados que tu sesión puede leer.</p>
          </div>
        </div>
        <Badge className="mt-3 sm:mt-0" tone="blue">No conectado al tutor</Badge>
      </div>

      <form className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={(event) => void submit(event)}>
        <label className="relative block">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Consulta para recuperar fragmentos</span>
          <input
            className="h-11 w-full rounded-full border border-control-border bg-surface pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            maxLength={500}
            placeholder="Ej. ¿Cómo se relacionan ATP y fotosíntesis?"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Alcance documental</span>
          <select
            className="h-11 rounded-full border border-control-border bg-surface px-4 text-sm font-semibold"
            value={scope}
            onChange={(event) => setScope(event.target.value as RagSearchScope)}
          >
            <option value="all">Todo autorizado</option>
            <option value="private">Privados</option>
            <option value="group">Grupos</option>
            <option value="classroom">Aula</option>
          </select>
        </label>
        <Button disabled={loading || query.trim().length < 3} type="submit">
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
          Recuperar
        </Button>
      </form>

      {error && <p className="mx-5 mb-5 rounded-xl border border-error-border bg-error-surface p-3 text-sm text-error" role="alert">{error}</p>}
      {searched && (
        <div className="border-t border-border p-5">
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-success" />
            {results.length} fragmentos autorizados · similitud semántica + texto completo
          </div>
          {results.length ? (
            <ol className="grid gap-3">
              {results.map((result) => (
                <li className="rounded-xl border border-border bg-background p-4" key={result.chunkId}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{result.documentTitle}</p>
                    <div className="flex items-center gap-2">
                      <Badge tone="blue">{pageLabel(result)}</Badge>
                      <span className="text-[11px] text-muted-foreground">RRF {result.combinedScore.toFixed(4)}</span>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{result.content}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No hay coincidencias en índices listos dentro de este alcance.</p>
          )}
        </div>
      )}
    </Card>
  );
}
