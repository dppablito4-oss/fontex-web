import { useEffect, useState } from "react";

export function AssessmentTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(() => elapsedSeconds(startedAt));
  useEffect(() => {
    const id = window.setInterval(() => setElapsed(elapsedSeconds(startedAt)), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");
  return <p className="text-sm tabular-nums text-muted-foreground">
    Tiempo transcurrido <time dateTime={`PT${elapsed}S`}>{minutes}:{seconds}</time>
  </p>;
}

function elapsedSeconds(startedAt: number) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}
