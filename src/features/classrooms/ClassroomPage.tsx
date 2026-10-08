import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Users } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../shared/PageHeader";

export function ClassroomPage() {
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Fundamentos de investigación · 2026-II"
        title="Tu aula"
        description="Materiales, actividades y anuncios organizados por el equipo docente."
        action={<Button variant="secondary"><CalendarDays className="size-4" /> Ver calendario</Button>}
      />
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-5 sm:p-7">
            <Badge tone="orange">Actividad en curso</Badge>
            <h2 className="section-title mt-4">Del tema al problema de investigación</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Formula una pregunta investigable, susténtala con dos fuentes del aula y compártela con tu grupo.</p>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-3">
            {["Revisar guía", "Seleccionar fuentes", "Enviar planteamiento"].map((item, index) => (
              <div className="bg-surface p-5" key={item}>
                <span className="font-mono text-xs text-muted">0{index + 1}</span>
                <p className="mt-3 text-sm font-semibold">{item}</p>
                <p className="mt-1 text-xs text-muted">{index < 2 ? "Completado" : "Pendiente"}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 sm:p-7">
          <p className="eyebrow">Comunidad</p>
          <div className="mt-5 space-y-5">
            <div className="flex items-center gap-3"><span className="metric-icon"><Users /></span><div><strong className="block text-xl">24</strong><span className="text-xs text-muted">estudiantes matriculados</span></div></div>
            <div className="flex items-center gap-3"><span className="metric-icon"><BookOpen /></span><div><strong className="block text-xl">8</strong><span className="text-xs text-muted">materiales del curso</span></div></div>
            <div className="flex items-center gap-3"><span className="metric-icon"><CheckCircle2 /></span><div><strong className="block text-xl">3</strong><span className="text-xs text-muted">actividades completadas</span></div></div>
          </div>
        </Card>
      </div>
      <Card className="mt-5 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <p className="eyebrow">Anuncio docente</p>
          <h2 className="mt-2 text-lg font-semibold">Nuevas lecturas disponibles para la unidad 03</h2>
          <p className="mt-1 text-sm text-muted">Revisa la guía metodológica antes de la siguiente sesión.</p>
        </div>
        <Button variant="secondary">Abrir materiales <ArrowRight className="size-4" /></Button>
      </Card>
    </div>
  );
}
