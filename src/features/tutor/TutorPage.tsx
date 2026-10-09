import { BookOpenText, ChevronDown, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ChatThread } from "./ChatThread";
import { FontexRuntimeProvider } from "./FontexRuntimeProvider";
import { isTutorLive } from "./tutorRuntime";

export function TutorPage() {
  return (
    <FontexRuntimeProvider>
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
        <header className="flex flex-col gap-4 border-b border-border px-4 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <div className="flex items-center gap-2">
              <p className="eyebrow">Tutor documental</p>
              <Badge tone={isTutorLive ? "green" : "orange"}>
                {isTutorLive ? "IA real conectada" : "Demo local"}
              </Badge>
            </div>
            <h1 className="mt-1 font-display text-3xl tracking-[-0.035em]">Consulta con contexto</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm"><ShieldCheck className="size-4" /> Modo estricto <ChevronDown className="size-3.5" /></Button>
            <Button variant="secondary" size="sm"><SlidersHorizontal className="size-4" /> Ajustes</Button>
          </div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="min-h-[36rem] bg-background" aria-label="Conversación con Fontex">
            <ChatThread isLive={isTutorLive} />
          </section>
          <aside className="border-t border-border bg-sidebar p-4 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <div><p className="eyebrow">Contexto activo</p><h2 className="mt-1 font-semibold">0 fuentes</h2></div>
              <BookOpenText className="size-5 text-primary" />
            </div>
            <Card className="mt-5 p-4">
              <p className="text-sm font-semibold">Motor RAG pendiente</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                La IA ya responde desde el servidor, pero los documentos autorizados se conectarán en la fase documental.
              </p>
            </Card>
            <Button className="mt-4 w-full" variant="secondary" size="sm" disabled>Fuentes aún no disponibles</Button>
            <div className="mt-6 rounded-2xl border border-info bg-info-surface p-4 text-xs leading-5 text-info-foreground">
              <strong className="block">Límite actual</strong>
              Fontex no afirmará haber consultado fuentes hasta que el motor RAG y sus citas estén conectados.
            </div>
          </aside>
        </div>
      </div>
    </FontexRuntimeProvider>
  );
}
