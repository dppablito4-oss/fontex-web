import { z } from "zod";
import { supabase } from "../../lib/supabase/client";
export const accountStatusNames = { active: "Activo", suspended: "Suspendido", blocked: "Bloqueado", deleting: "Eliminación pendiente", deleted: "Eliminado de Fontex" };
export type AccountAction = "suspend" | "ban" | "restore" | "delete";
const messages: Record<string,string> = {
  admin_mfa_required: "Verifica tu segundo factor para administrar cuentas.",
  protected_admin_account: "Los administradores están protegidos contra bloqueo y eliminación.",
  account_confirmation_required: "Escribe exactamente el correo de la cuenta que vas a eliminar.",
  account_owns_shared_resources: "Esta cuenta tiene aulas, organizaciones o grupos compartidos, o clases publicadas. Reasigna esos recursos antes de eliminarla.",
  account_generation_pending: "Hay una generación en curso. Espera a que termine antes de eliminar la cuenta.",
  account_deletion_pending: "La eliminación ya empezó. Reinténtala para terminar de retirar sus datos.",
  account_blocked: "La cuenta está bloqueada. Reactívala antes de suspenderla.",
  account_deleted: "La cuenta ya fue eliminada de Fontex y no se puede reactivar.",
  account_storage_failed: "No se pudieron retirar todos los PDF. Reintenta la eliminación para terminar.",
};
export async function accountAction(userId:string, action:AccountAction, reason:string, hours:number, confirmation:string, requestId:string) {
  if(!supabase) throw Error("Inicia sesión para administrar cuentas.");
  if(action === "delete") {
    const result=await supabase.functions.invoke<unknown>("account-admin",{body:{userId,reason,confirmation,requestId}});
    const data:unknown=result.data, error:unknown=result.error;
    if(error) {
      let code="";try { const context=z.object({context:z.instanceof(Response)}).safeParse(error);const response=result.response??(context.success?context.data.context:undefined);const body:unknown=await response?.json();const parsed=z.object({code:z.string()}).safeParse(body);code=parsed.success?parsed.data.code:""; } catch { /* Generic error if the server response is unavailable. */ }
      throw Error(messages[code]??"No se pudo confirmar la eliminación. Puedes reintentar sin duplicarla.");
    }
    if(!z.object({deleted:z.literal(true)}).safeParse(data).success) throw Error("No se pudo confirmar la eliminación.");
  } else {
    const {error}=await supabase.rpc("admin_account_access",{p_user_id:userId,p_action:action,p_hours:hours,p_reason:reason,p_request_id:requestId});
    if(error) throw Error(Object.entries(messages).find(([code])=>error.message.includes(code))?.[1]??"No se pudo cambiar el acceso de la cuenta.");
  }
}
export async function accountHistory(userId:string) {
  if(!supabase)return [];
  const {data,error}=await supabase.rpc("admin_account_history",{p_user_id:userId});
  if(error)throw Error("No se pudo cargar el historial de acceso.");
  return z.array(z.object({action:z.enum(["suspend","ban","restore","delete"]),reason:z.string(),suspended_until:z.string().nullable(),completed:z.boolean(),created_at:z.string()})).parse(data);
}
