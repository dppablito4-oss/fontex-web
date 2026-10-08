import { Database, Gauge, LockKeyhole, Settings2 } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../shared/PageHeader";

const items = [
  { icon: LockKeyhole, title: "Identidad y permisos", detail: "Pendiente del Bloque 1", tone: "orange" as const },
  { icon: Database, title: "Almacenamiento", detail: "Sin conexión configurada", tone: "neutral" as const },
  { icon: Gauge, title: "Cuotas del aula", detail: "Valores de demostración", tone: "blue" as const },
  { icon: Settings2, title: "Configuración general", detail: "Interfaz inicial", tone: "green" as const },
];

export function AdminPage() {
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Configuración" title="Administración" description="Vista preliminar de los controles del aula. Ninguna acción modifica datos reales en este bloque." />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map(({ icon: Icon, title, detail, tone }) => (
          <Card key={title} className="flex items-center gap-4 p-5 sm:p-6">
            <span className="metric-icon"><Icon /></span>
            <div className="flex-1"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{detail}</p></div>
            <Badge tone={tone}>Mock</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
