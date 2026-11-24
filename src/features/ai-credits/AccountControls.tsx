import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import type { CreditAccount } from "./service";
import { accountAction, accountHistory, accountStatusNames, type AccountAction } from "./account-controls";
const actionNames={suspend:"Suspender",ban:"Bloquear",restore:"Reactivar",delete:"Eliminar de Fontex"};
export function AccountControls({account,onUpdated,disabled=false,onPending}:{account:CreditAccount;onUpdated:()=>Promise<void>;disabled?:boolean;onPending?:(value:boolean)=>void}) {
  const [action,setAction]=useState<AccountAction>("suspend"),[hours,setHours]=useState(24),[reason,setReason]=useState(""),[confirmation,setConfirmation]=useState("");
  const [pending,setPending]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [history,setHistory]=useState<Awaited<ReturnType<typeof accountHistory>>>([]);
  const request=useRef({key:"",id:""});
  useEffect(()=>{let active=true;void accountHistory(account.user_id).then(rows=>{if(active)setHistory(rows);}).catch(()=>{if(active)setError("No se pudo cargar el historial de acceso.");});return()=>{active=false;};},[account.user_id,message]);
  const status=account.status??"active", chosen=status==="deleting"?"delete":action;
  async function submit(e:FormEvent) {
    e.preventDefault();if(pending||disabled)return;
    const key=JSON.stringify([account.user_id,chosen,hours,reason,confirmation]);
    if(request.current.key!==key)request.current={key,id:crypto.randomUUID()};
    setPending(true);onPending?.(true);setError("");setMessage("");
    try {await accountAction(account.user_id,chosen,reason,hours,confirmation,request.current.id);request.current={key:"",id:""};setMessage("Operación de cuenta confirmada.");await onUpdated();}
    catch(e){setError(e instanceof Error?e.message:"No se pudo completar la operación.");try{await onUpdated();}catch{/* Keep the original action error when refresh is unavailable. */}}
    finally{setPending(false);onPending?.(false);}
  }
  return <section className="ai-account-controls" aria-label="Acceso y eliminación de cuenta">
    <h3>Acceso a Fontex · {accountStatusNames[status]}</h3>
    {account.suspended_until&&status==="suspended"&&<p>Hasta {new Date(account.suspended_until).toLocaleString("es")}. Se reactiva automáticamente al vencer el plazo.</p>}
    {account.is_admin?<p>Esta cuenta administrativa está protegida contra suspensión, bloqueo y eliminación.</p>:status==="deleted"?<p>El acceso y el contenido personal de Fontex fueron eliminados. La identidad compartida se conserva.</p>:<form className="ai-grant-form" onSubmit={e=>void submit(e)}>
      <label className="form-field"><span>Acción sobre la cuenta</span><select value={chosen} disabled={pending||disabled||status==="deleting"} onChange={e=>setAction(e.target.value as AccountAction)}>{Object.entries(actionNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
      {chosen==="suspend"&&<label className="form-field"><span>Duración de la suspensión</span><select value={hours} disabled={pending||disabled} onChange={e=>setHours(Number(e.target.value))}>{[[1,"1 hora"],[24,"1 día"],[168,"7 días"],[720,"30 días"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
      <label className="form-field"><span>Motivo de la operación</span><input required minLength={3} maxLength={500} value={reason} disabled={pending||disabled} onChange={e=>setReason(e.target.value)}/></label>
      {chosen==="delete"&&<><p>Se borran los lienzos, PDF, conversaciones y respuestas personales guardados en Fontex. La cuenta compartida y la otra aplicación se conservan, al igual que la auditoría mínima de administración, créditos y uso. Las copias descargadas no se retiran.</p><label className="form-field"><span>Confirma el correo para eliminar</span><input required value={confirmation} placeholder={account.email??account.user_id} disabled={pending||disabled} onChange={e=>setConfirmation(e.target.value)}/></label></>}
      <Button disabled={pending||disabled||reason.trim().length<3||(chosen==="delete"&&confirmation.trim().toLowerCase()!==(account.email??account.user_id).toLowerCase())} type="submit">{pending?"Aplicando…":actionNames[chosen]}</Button>
    </form>}
    {error&&<p role="alert" className="ai-credit-error">{error}</p>}{message&&<p role="status" className="ai-credit-success">{message}</p>}
    <details><summary>Historial de acceso</summary>{history.length?<ul>{history.map((event,index)=><li key={`${event.created_at}-${index}`}><strong>{actionNames[event.action]}</strong> · {new Date(event.created_at).toLocaleString("es")} · {event.reason}{!event.completed?" · Pendiente":""}</li>)}</ul>:<p>Sin operaciones de acceso registradas.</p>}</details>
  </section>;
}
