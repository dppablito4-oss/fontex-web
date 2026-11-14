import { useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from "react";
import { InlineEditingContext } from "./inline-editing-context";
import { editField, fieldSpec, fieldValue, formatField } from "./inline-fields";

/** A displayed input value becomes editable only inside an editable canvas object. */
export function InlineValue({ field, value, index, children, readOnly = false }: { field: string; value: unknown; index?: number; children?: ReactNode; readOnly?: boolean }) {
  const editor = useContext(InlineEditingContext);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const original = useRef<ReturnType<typeof editField> | null>(null);
  const cancelled = useRef(false);
  const id = useId();
  const end = editor?.onEnd;
  useEffect(() => () => { if (original.current) end?.(); }, [end]);
  if (!editor || readOnly) return <>{children ?? String(value)}</>;
  const spec = fieldSpec(editor.object, field);
  const actual = fieldValue(editor.object, field);
  const shown = index === undefined ? actual : (actual as number[])[index];
  const formatted = formatField(shown, index === undefined ? spec.kind : undefined);
  const label = index === undefined ? spec.label : `${spec.label}: número ${index + 1}`;
  const text = draft ?? formatted;
  function change(raw: string) {
    setDraft(raw);
    try {
      editor!.onChange(editField(editor!.object, field, raw, index));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Revisa el valor."); }
  }
  const common = {
    "aria-label": label, "aria-invalid": !!error, "aria-describedby": error ? id : undefined,
    title: `${spec.label}. ${spec.hint ?? "Edita aquí; el dibujo se actualiza al instante."}`,
    value: text,
    onFocus: () => { original.current = editor.object; cancelled.current = false; setDraft(formatted); editor.onBegin?.(); },
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => change(event.target.value),
    onBlur: () => { if (!cancelled.current) editor.onEnd?.(); original.current = null; setDraft(null); setError(""); },
    onKeyDown: (event: React.KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault(); cancelled.current = true;
        if (editor.onCancel) editor.onCancel(); else if (original.current) editor.onChange(original.current);
        (event.target as HTMLElement).blur(); setDraft(null); setError("");
      } else if (event.key === "Enter" && (spec.kind !== "multiline" || event.ctrlKey || event.metaKey)) {
        event.preventDefault(); (event.target as HTMLElement).blur();
      }
    },
  };
  return <span className={`st-inline-value ${spec.kind === "multiline" ? "st-inline-multiline" : ""}`} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    {spec.choices ? <select {...common} className="st-inline-input">{Object.entries(spec.choices).map(([key, caption]) => <option key={key} value={key}>{caption}</option>)}</select>
      : spec.kind === "multiline" ? <GrowingText resizeKey={editor.object.type === "text" ? editor.object.data.fontSize : undefined} {...common} className="st-inline-input" maxLength={5000} />
      : <input {...common} className="st-inline-input" inputMode={spec.kind === "decimal" || spec.kind === "real" ? "decimal" : !spec.kind || index !== undefined ? "numeric" : "text"} maxLength={field === "label" ? 120 : 500} style={{ width: `${Math.min(45, Math.max(2, text.length + 1))}ch` }} />}
    {error && <span className="st-inline-error" role="alert" id={id}>{error}</span>}
  </span>;
}

export function InlineOnly({ children }: { children: ReactNode }) {
  return useContext(InlineEditingContext) ? <>{children}</> : null;
}
export function InlineEquation({ a, b, c, d, children }: { a: number; b: number; c: number; d: number; children: ReactNode }) {
  return useContext(InlineEditingContext) ? <><InlineValue field="a" value={a} />x + (<InlineValue field="b" value={b} />) = <InlineValue field="c" value={c} />x + (<InlineValue field="d" value={d} />)</> : <>{children}</>;
}

/** Keep native SVG labels in exported and read-only materials. */
export function InlineSvgValue({ field, value, x, y, width = 120, prefix = "", suffix = "" }: { field: string; value: number; x: number; y: number; width?: number; prefix?: string; suffix?: string }) {
  const editor = useContext(InlineEditingContext);
  return editor ? <foreignObject x={x - width / 2} y={y - 27} width={width} height="64"><div className="st-inline-svg-caption">{prefix}<InlineValue field={field} value={value} />{suffix}</div></foreignObject>
    : <text x={x} y={y} textAnchor="middle" fill="currentColor" fontSize="16">{prefix}{value}{suffix}</text>;
}

function GrowingText({ resizeKey, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { resizeKey?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => { element.style.height = "auto"; element.style.height = `${element.scrollHeight + 1}px`; };
    fit();
    let width = element.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const next = element.getBoundingClientRect().width;
      if (Math.abs(next - width) > .5) { width = next; fit(); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.value, resizeKey]);
  return <textarea {...props} ref={ref} rows={1} />;
}
