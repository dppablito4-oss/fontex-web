import { useState, type KeyboardEvent, type FocusEvent } from "react";
import type { Primitive, PrimitiveScene } from "../../core/primitives/schema";
import { allowedPracticeFields, applyPracticeValue, practiceFields, type PracticeField } from "../../core/primitives/practice";

function InlineValue({field,onApply}: {field:PracticeField;onApply:(raw:string)=>void}) {
  const [draft,setDraft]=useState<string|null>(null),[error,setError]=useState("");
  const apply=()=>{try{onApply(draft ?? field.value);setDraft(null);setError("");}catch(e){setError(e instanceof Error?e.message:"Revisa el valor.");}};
  const keyDown=(e:KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>{
    e.stopPropagation();if(e.key==="Enter" && !e.shiftKey){e.preventDefault();apply();}
    if(e.key==="Escape"){setDraft(null);setError("");}
  };
  const blur=(e:FocusEvent<HTMLInputElement|HTMLTextAreaElement>)=>{
    if(!e.currentTarget.parentElement?.parentElement?.contains(e.relatedTarget)){setDraft(null);setError("");}
  };
  return <div className="pc-inline-value">
    {draft===null ? <button type="button" aria-label={`Cambiar ${field.label}`} onClick={()=>{setDraft(field.value);setError("");}}>{field.label}: <strong>{field.value || "Responder"}</strong><span aria-hidden="true">✎</span></button>
      : <div className="pc-inline-input">
        <label>{field.label}{field.multiline
          ? <textarea autoFocus rows={3} aria-label={field.label} aria-invalid={!!error} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={keyDown} onBlur={blur}/>
          : <input autoFocus aria-label={field.label} aria-invalid={!!error}
            inputMode={field.type==="number"?"decimal":"text"} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={keyDown} onBlur={blur}/>}</label>
        <button type="button" aria-label={`Aplicar ${field.label}`} onMouseDown={e=>e.preventDefault()} onClick={apply}>✓</button>
        <button type="button" aria-label="Cancelar cambio" onMouseDown={e=>e.preventDefault()} onClick={()=>{setDraft(null);setError("");}}>×</button>
      </div>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
export function PracticeValue({p,scene,fieldKey,onApply,fallback}: {
  p:Primitive;scene:PrimitiveScene;fieldKey:string;onApply:(next:PrimitiveScene)=>boolean|void;fallback:React.ReactNode;
}) {
  const field=allowedPracticeFields(p,scene).find(f=>f.key===fieldKey && f.type!=="drawing");
  return field ? <InlineValue field={field} onApply={raw=>{
    if(onApply(applyPracticeValue(scene,p.id,fieldKey,raw))===false) throw Error("No se pudo guardar el cambio.");
  }}/> : <>{fallback}</>;
}
export function PracticeFields({p,scene,onApply}: {p:Primitive;scene:PrimitiveScene;onApply:(next:PrimitiveScene)=>boolean|void}) {
  const fields=allowedPracticeFields(p,scene).filter(f=>f.type!=="drawing" && !(p.kind==="data_chart" && (/^rows\.\d+\.valueExpr$/.test(f.key) || f.key.startsWith("matrixCells."))));
  if(!fields.length) return null;
  return <div className="pc-practice-fields" aria-label={`Valores del ejercicio: ${p.label}`}
    onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>
    {fields.map(field=><InlineValue key={field.key} field={field} onApply={raw=>{
      const next=applyPracticeValue(scene,p.id,field.key,raw);
      if(onApply(next)===false) throw Error("No se pudo guardar el cambio. Reintenta.");
    }}/>)}
  </div>;
}
export function PracticePermissions({p,scene,onChange}: {p:Primitive;scene:PrimitiveScene;onChange:(p:Primitive)=>void}) {
  const fields=practiceFields(p,scene).filter(f=>!(p.kind==="answer_field" && f.key==="answer"));
  return <details className="pc-practice-permissions"><summary>Valores que puede cambiar el alumno</summary>
    <p>Marca únicamente los valores solicitados por este ejercicio. La consigna y las definiciones permanecen fijas.</p>
    {fields.length ? fields.map(field=><label key={field.key}><input type="checkbox"
      checked={p.interaction?.fields.includes(field.key)??false}
      onChange={e=>onChange({...p,interaction:{fields:e.target.checked
        ? [...new Set([...(p.interaction?.fields??[]),field.key])]
        : (p.interaction?.fields??[]).filter(key=>key!==field.key)}})}/>{field.label}</label>)
      : <p>{p.kind==="answer_field" ? "La respuesta siempre está habilitada; la consigna permanece fija." : "Este elemento contiene texto fijo. Añade «Respuesta del alumno» para pedir una respuesta."}</p>}
  </details>;
}
