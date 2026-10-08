import { FlaskConical } from "lucide-react";

export function DemoNotice() {
  return (
    <div className="demo-notice" role="status">
      <FlaskConical className="size-3.5" aria-hidden="true" />
      Espacio de demostración · datos ficticios
    </div>
  );
}
