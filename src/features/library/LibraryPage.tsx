import { Filter, Plus, Search, SlidersHorizontal } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { FileRow } from "../shared/FileRow";
import { PageHeader } from "../shared/PageHeader";

export function LibraryPage() {
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="12 documentos · 84 páginas indexables"
        title="Biblioteca"
        description="Organiza tus fuentes y reconoce siempre quién puede consultarlas."
        action={<Button><Plus className="size-4" /> Añadir PDF</Button>}
      />
      <Card className="mt-8 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <span className="sr-only">Buscar documentos</span>
            <input className="h-11 w-full rounded-full border border-line bg-paper pl-10 pr-4 text-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10" placeholder="Buscar por título o contenido…" />
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm"><Filter className="size-3.5" /> Alcance</Button>
            <Button variant="secondary" size="sm"><SlidersHorizontal className="size-3.5" /> Ordenar</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line bg-[#fbfaf6] px-5 py-3">
          <Badge tone="green">Todos · 12</Badge><Badge>Privados · 5</Badge><Badge tone="blue">Grupo · 3</Badge><Badge tone="orange">Aula · 4</Badge>
        </div>
        <FileRow title="Metodología de la investigación.pdf" meta="Actualizado hoy · 2.4 MB" pages={32} scope="Aula" />
        <FileRow title="Notas sobre fuentes primarias.pdf" meta="Actualizado ayer · 860 KB" pages={8} scope="Privado" />
        <FileRow title="Guía para formular el problema.pdf" meta="Actualizado 6 oct · 1.1 MB" pages={18} scope="Grupo" />
        <FileRow title="Ética e integridad académica.pdf" meta="Actualizado 2 oct · 1.8 MB" pages={26} scope="Aula" />
      </Card>
      <p className="mt-4 text-center text-xs text-muted">Prototipo visual: la carga y el procesamiento de archivos se implementarán en el Bloque 2.</p>
    </div>
  );
}
