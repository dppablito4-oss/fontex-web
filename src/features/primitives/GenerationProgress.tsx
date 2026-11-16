import { useEffect, useState } from "react";
export function GenerationProgress({ building }: { building: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now()-start)/1000)),1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="pc-writing" role="status">{building ? "Construyendo en el lienzo…" : "Escribiendo…"} {seconds > 0 && `${seconds} s`}
    {building && seconds >= 20 && <small>Un ejercicio grande puede tardar unos 2 minutos. Aparecerá al completar la validación; puedes detenerlo desde este panel.</small>}
  </span>;
}
