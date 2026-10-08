import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Clock3,
  FilePlus2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

const recent = [
  {
    icon: MessageSquareText,
    title: "¿Cómo se diferencia una fuente primaria?",
    detail: "Tutor · hace 18 min",
    color: "bg-[#e2eee7] text-forest",
  },
  {
    icon: FilePlus2,
    title: "Métodos de investigación — semana 3.pdf",
    detail: "Añadido a Mi grupo · ayer",
    color: "bg-[#fff0e4] text-[#985126]",
  },
  {
    icon: CheckCircle2,
    title: "Actividad: formulación del problema",
    detail: "Completada · 6 oct",
    color: "bg-[#eaf1f5] text-[#31576c]",
  },
];

export function HomePage() {
  return (
    <div className="page-wrap">
      <section className="hero-grid overflow-hidden rounded-[2rem] border border-line bg-ink text-paper">
        <div className="relative z-10 p-6 sm:p-9 lg:p-11">
          <Badge className="border-white/20 bg-white/10 text-[#e8eee9]" tone="neutral">
            <Sparkles className="size-3" /> Tutor documental
          </Badge>
          <h1 className="mt-7 max-w-2xl font-display text-[clamp(2.7rem,6vw,5.4rem)] leading-[0.92] tracking-[-0.055em]">
            Tus fuentes.
            <br />
            <span className="text-[#b9d4c3]">Ahora con sentido.</span>
          </h1>
          <p className="mt-7 max-w-xl text-sm leading-6 text-[#c9d0cc] sm:text-base">
            Pregunta, contrasta y aprende a partir de materiales autorizados. Cada respuesta conserva el camino de vuelta a su fuente.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="accent">
              <Link to="/tutor">
                Consultar al tutor <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild className="border-white/20 bg-white/10 text-white hover:bg-white/15" variant="secondary">
              <Link to="/biblioteca">Explorar biblioteca</Link>
            </Button>
          </div>
        </div>
        <div className="source-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring-one" />
          <div className="orbit-ring orbit-ring-two" />
          <div className="source-card source-card-one">
            <span>01</span>
            <strong>Artículo científico</strong>
            <small>p. 12–14</small>
          </div>
          <div className="source-card source-card-two">
            <span>02</span>
            <strong>Notas de clase</strong>
            <small>Unidad 03</small>
          </div>
          <div className="context-core">
            <Sparkles className="size-6" />
            <span>contexto</span>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Continúa aprendiendo</p>
              <h2 className="section-title mt-2">Tu espacio de hoy</h2>
            </div>
            <Badge tone="green"><span className="status-dot" /> Al día</Badge>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Link to="/biblioteca" className="quick-card group">
              <span className="quick-icon bg-[#e5efe9] text-forest"><BookOpenText /></span>
              <strong>12 fuentes</strong>
              <span>En tu biblioteca</span>
              <ArrowRight className="quick-arrow" />
            </Link>
            <Link to="/tutor" className="quick-card group">
              <span className="quick-icon bg-[#fff0e4] text-[#985126]"><MessageSquareText /></span>
              <strong>3 consultas</strong>
              <span>Esta semana</span>
              <ArrowRight className="quick-arrow" />
            </Link>
            <Link to="/aula" className="quick-card group">
              <span className="quick-icon bg-[#eaf1f5] text-[#31576c]"><Clock3 /></span>
              <strong>1 pendiente</strong>
              <span>Próxima actividad</span>
              <ArrowRight className="quick-arrow" />
            </Link>
          </div>
        </Card>

        <Card className="p-5 sm:p-7">
          <p className="eyebrow">Siguiente paso</p>
          <div className="mt-5 flex gap-4">
            <div className="date-block"><strong>14</strong><span>OCT</span></div>
            <div>
              <h2 className="text-lg font-semibold">Del tema al problema</h2>
              <p className="mt-1 text-sm leading-5 text-muted">Entrega del planteamiento inicial para revisión del grupo.</p>
            </div>
          </div>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-sage">
            <div className="h-full w-[68%] rounded-full bg-forest" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-medium text-muted">
            <span>2 de 3 pasos</span><span>68%</span>
          </div>
        </Card>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow">En movimiento</p>
            <h2 className="section-title mt-1">Actividad reciente</h2>
          </div>
          <Button variant="ghost" size="sm">Ver todo <ArrowRight className="size-3.5" /></Button>
        </div>
        <Card className="overflow-hidden">
          {recent.map(({ icon: Icon, title, detail, color }) => (
            <div key={title} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${color}`}><Icon className="size-[18px]" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-muted">{detail}</p>
              </div>
              <ArrowRight className="size-4 text-muted" />
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
