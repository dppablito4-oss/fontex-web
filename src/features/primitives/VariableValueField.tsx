import { useId, useState } from "react";
import type { SceneVariable } from "../../core/primitives/schema";

export function VariableValueField({ variable, onChange }: {
  variable: SceneVariable;
  onChange: (name: string, value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const errorId = useId();
  const apply = () => {
    if (draft === null) return;
    const value = Number(draft.trim().replace(",", "."));
    if (!draft.trim() || !Number.isFinite(value) || Math.abs(value) > 1e6) {
      setError("Escribe un número entre −1 000 000 y 1 000 000.");
      return;
    }
    onChange(variable.name, value);
    setDraft(null);
    setError("");
  };
  return <label className="pc-exact-value">
    <span>Valor de {variable.name}</span>
    <span className="pc-unit-input">
      <input
        aria-label={`Valor de ${variable.name}`}
        inputMode="decimal"
        value={draft ?? String(variable.value)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onFocus={() => setDraft(String(variable.value))}
        onChange={(e) => { setDraft(e.target.value); setError(""); }}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); apply(); }
          if (e.key === "Escape") { e.stopPropagation(); setDraft(null); setError(""); }
        }}
      />
      {variable.unit && <span>{variable.unit}</span>}
    </span>
    {error && <small id={errorId} role="alert">{error}</small>}
  </label>;
}
