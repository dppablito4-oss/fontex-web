import { BookCheck, ChevronDown, FileText, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ChatThread } from "./ChatThread";
import { FontexRuntimeProvider } from "./FontexRuntimeProvider";

export function TutorPage() {
  return (
    <FontexRuntimeProvider>
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
        <header className="flex flex-col gap-4 border-b border-line px-4 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <div className="flex items-center gap-2">
              <p className="eyebrow">Tutor documental</p>
              <Badge tone="orange">Simulación local</Badge>
            </div>
            <h1 className="mt-1 font-display text-3xl tracking-[-0.035em]">Consulta con contexto</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm"><ShieldCheck className="size-4" /> Modo estricto <ChevronDown className="size-3.5" /></Button>
            <Button variant="secondary" size="sm"><SlidersHorizontal className="size-4" /> Ajustes</Button>
          </div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="min-h-[36rem] bg-[#fbfaf6]" aria-label="Conversación con Fontex">
            <ChatThread />
          </section>
          <aside className="border-t border-line bg-paper p-4 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <div><p className="eyebrow">Contexto activo</p><h2 className="mt-1 font-semibold">3 fuentes</h2></div>
              <BookCheck className="size-5 text-forest" />
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Metodología de la investigación", "Aula · 32 pág."],
                ["Notas sobre fuentes primarias", "Privado · 8 pág."],
                ["Guía para formular el problema", "Grupo · 18 pág."],
              ].map(([name, detail], index) => (
                <Card className="flex gap-3 p-3" key={name}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sage text-forest"><FileText className="size-4" /></span>
                  <div className="min-w-0"><p className="line-clamp-2 text-xs font-semibold leading-4">{name}</p><p className="mt-1 text-[10px] text-muted">{detail}</p></div>
                  <span className="ml-auto mt-1 size-2 shrink-0 rounded-full bg-forest" title={`Fuente ${index + 1} seleccionada`} />
                </Card>
              ))}
            </div>
            <Button className="mt-4 w-full" variant="secondary" size="sm">Cambiar fuentes</Button>
            <div className="mt-6 rounded-2xl bg-[#e8f0eb] p-4 text-xs leading-5 text-forest">
              <strong className="block">Cómo responderá Fontex</strong>
              Si la evidencia no alcanza, lo dirá en lugar de completar la respuesta con información no verificada.
            </div>
          </aside>
        </div>
      </div>
    </FontexRuntimeProvider>
  );
}
