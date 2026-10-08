import { MessageCircle, Plus, UsersRound } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { FileRow } from "../shared/FileRow";
import { PageHeader } from "../shared/PageHeader";

const members = [
  ["AM", "Ana Mendoza", "Tú"],
  ["LC", "Luis Cabrera", "En línea"],
  ["SR", "Sofía Rojas", "Hace 12 min"],
  ["JM", "José Medina", "Ayer"],
];

export function GroupPage() {
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Grupo 04"
        title="Horizonte"
        description="Un espacio compartido para contrastar fuentes y construir el planteamiento del equipo."
        action={<Button><Plus className="size-4" /> Compartir fuente</Button>}
      />
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line p-5">
            <div><p className="eyebrow">Biblioteca grupal</p><h2 className="mt-1 text-lg font-semibold">Fuentes compartidas</h2></div>
            <Badge tone="blue">3 documentos</Badge>
          </div>
          <FileRow title="Guía para formular el problema.pdf" meta="Compartido por Sofía" pages={18} scope="Grupo" />
          <FileRow title="Estado del arte — borrador.pdf" meta="Compartido por Luis" pages={9} scope="Grupo" />
          <FileRow title="Matriz de antecedentes.pdf" meta="Compartido por ti" pages={4} scope="Grupo" />
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="eyebrow">Equipo</p><h2 className="mt-1 text-lg font-semibold">4 integrantes</h2></div><UsersRound className="size-5 text-muted" /></div>
          <div className="mt-5 space-y-4">
            {members.map(([initials, name, state], index) => (
              <div key={name} className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-sage text-xs font-bold text-forest">{initials}</span>
                <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{name}</strong><span className="text-xs text-muted">{state}</span></div>
                {index === 0 && <Badge tone="green">Coordinadora</Badge>}
              </div>
            ))}
          </div>
          <Button className="mt-6 w-full" variant="secondary"><MessageCircle className="size-4" /> Abrir conversación</Button>
        </Card>
      </div>
    </div>
  );
}
