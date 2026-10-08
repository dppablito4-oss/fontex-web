import { FileText, MoreHorizontal } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

export function FileRow({
  title,
  meta,
  pages,
  scope,
}: {
  title: string;
  meta: string;
  pages: number;
  scope: "Privado" | "Grupo" | "Aula";
}) {
  const tone = scope === "Privado" ? "neutral" : scope === "Grupo" ? "blue" : "green";

  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sage text-forest">
        <FileText className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="mt-1 truncate text-xs text-muted">
          {meta} · {pages} páginas
        </p>
      </div>
      <Badge tone={tone}>{scope}</Badge>
      <Button variant="ghost" size="icon" aria-label={`Opciones de ${title}`}>
        <MoreHorizontal className="size-5" />
      </Button>
    </div>
  );
}
